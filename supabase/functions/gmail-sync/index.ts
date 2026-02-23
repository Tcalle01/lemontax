// supabase/functions/gmail-sync/index.ts
// Corre cada 12h via cron, o manualmente desde el botón refresh en la UI

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const AÑO = String(new Date().getFullYear());

async function refrescarToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.access_token) return data.access_token;
  console.error("Error refrescando token:", data.error, data.error_description);
  return null;
}

async function buscarEmailIds(accessToken: string): Promise<string[]> {
  // Búsqueda amplia: emails que mencionen factura/comprobante/xml en subject o body,
  // O que tengan adjuntos xml/zip — luego filtramos internamente
  const queries = [
    `(subject:factura OR subject:comprobante OR subject:xml OR subject:facturacion) after:${AÑO}/01/01`,
    `(filename:xml OR filename:zip) after:${AÑO}/01/01`,
    `("comprobante electronico" OR "factura electronica" OR "comprobante electrónico" OR "factura electrónica") after:${AÑO}/01/01`,
  ];

  const allIds = new Set<string>();

  for (const query of queries) {
    let pageToken: string | undefined;
    do {
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=500${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      (data.messages || []).forEach((m: { id: string }) => allIds.add(m.id));
      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  console.log(`Total emails a revisar: ${allIds.size}`);
  return Array.from(allIds);
}

async function descargarAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Uint8Array | null> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!data.data) return null;
  const b64 = data.data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function extraerXMLsDeZip(zipBytes: Uint8Array): Promise<string[]> {
  const xmls: string[] = [];
  const view = new DataView(zipBytes.buffer);
  let offset = 0;

  while (offset < zipBytes.length - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) { offset++; continue; }

    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const fileName = new TextDecoder().decode(zipBytes.slice(offset + 30, offset + 30 + fileNameLen));
    const dataStart = offset + 30 + fileNameLen + extraLen;
    const compressedData = zipBytes.slice(dataStart, dataStart + compressedSize);

    if (fileName.toLowerCase().endsWith(".xml")) {
      try {
        let xmlText: string;
        if (compression === 8) {
          const ds = new DecompressionStream("deflate-raw");
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();
          writer.write(compressedData);
          writer.close();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          const total = chunks.reduce((a, b) => a + b.length, 0);
          const result = new Uint8Array(total);
          let pos = 0;
          for (const chunk of chunks) { result.set(chunk, pos); pos += chunk.length; }
          xmlText = new TextDecoder("utf-8").decode(result);
        } else {
          xmlText = new TextDecoder("utf-8").decode(compressedData);
        }
        xmls.push(xmlText);
      } catch (e) {
        console.error("Error extrayendo ZIP:", fileName, e);
      }
    }
    offset = dataStart + compressedSize;
  }
  return xmls;
}

async function extraerXMLsDelMensaje(accessToken: string, messageId: string): Promise<string[]> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const msg = await res.json();
  const xmls: string[] = [];

  const procesarPartes = async (partes: any[]) => {
    if (!partes) return;
    for (const parte of partes) {
      const nombre = (parte.filename || "").toLowerCase();
      const mime = (parte.mimeType || "").toLowerCase();
      const attId = parte.body?.attachmentId;

      if (attId && (nombre.endsWith(".xml") || mime.includes("xml"))) {
        const bytes = await descargarAttachment(accessToken, messageId, attId);
        if (bytes) xmls.push(new TextDecoder("utf-8").decode(bytes));
      } else if (attId && nombre.endsWith(".zip")) {
        const bytes = await descargarAttachment(accessToken, messageId, attId);
        if (bytes) xmls.push(...await extraerXMLsDeZip(bytes));
      }
      if (parte.parts) await procesarPartes(parte.parts);
    }
  };

  await procesarPartes(msg.payload?.parts || [msg.payload]);
  return xmls;
}

function decodificarHTML(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'");
}

function parsearXML(xmlString: string): any | null {
  try {
    if (xmlString.includes("SharingMessage") || xmlString.includes("<html")) return null;

    let xmlToParse = xmlString;

    // Caso 1: CDATA estándar del SRI
    const cdataMatch = xmlString.match(/<comprobante[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>/);
    if (cdataMatch) {
      xmlToParse = cdataMatch[1].trim();
    } else {
      // Caso 2: HTML-encoded (como Tipti) — <comprobante>&lt;factura...&gt;</comprobante>
      const encodedMatch = xmlString.match(/<comprobante[^>]*>([\s\S]*?)<\/comprobante>/);
      if (encodedMatch && encodedMatch[1].includes("&lt;")) {
        xmlToParse = decodificarHTML(encodedMatch[1].trim());
      }
      // Caso 3: XML directo sin wrapper
    }

    const get = (tag: string) => {
      const m = xmlToParse.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };

    const ruc = get("rucEmisor") || get("ruc");
    const emisor = get("razonSocialEmisor") || get("razonSocial") || get("denominacion") || "Desconocido";
    const fechaEmision = get("fechaEmision");
    const monto = parseFloat(get("importeTotal") || get("valorTotal") || get("total") || "0");
    const claveAcceso = get("claveAcceso") || get("numeroAutorizacion") || get("claveAccesoConsultada");
    const codDoc = get("codDoc");

    if (!ruc || monto <= 0) return null;
    if (codDoc && !["01", "03", "04", "05", "06", ""].includes(codDoc)) return null;

    let fecha = fechaEmision;
    if (fechaEmision?.includes("/")) {
      const [d, m, y] = fechaEmision.split("/");
      fecha = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    if (!fecha?.startsWith(AÑO)) return null;

    const descripciones = (xmlToParse.match(/<descripcion>([^<]+)<\/descripcion>/gi) || [])
      .map((s: string) => s.replace(/<\/?descripcion>/gi, ""))
      .join(" ");

    return { ruc, emisor, fecha, monto, claveAcceso, descripciones };
  } catch {
    return null;
  }
}

function categorizar(emisor: string, descripciones: string): string {
  // Normaliza eliminando tildes para matching consistente
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const txt = n(`${emisor} ${descripciones}`);

  // ── Alimentación ─────────────────────────────────────────────────────────────
  if (/(supermaxi|megamaxi|gran aki|mediano aki|saludmarket|reposta|comisariato|hipermercado|supermercado|minimarket|autoservicio|superbodega|superdelis)/.test(txt)) return "Alimentación";
  if (/(tia\b|aki\b|santa maria\b|coral\b|la favorita|pronaca|dipaso|disco\b|supertienda)/.test(txt)) return "Alimentación";
  if (/(restauran|cevicheria|marisqueria|parrillada|asadero|grill\b|bistro|bodegon|taberna|picanteria|fritadero|soda\b|fonda\b)/.test(txt)) return "Alimentación";
  if (/(pizza|hamburgues|burger|sushi|chifa|tacos|burritos|sandwich|wings|wingstop)/.test(txt)) return "Alimentación";
  if (/(kfc\b|mcdonalds|mcdonald|burger king|pizza hut|dominos|papa john|subway|pollo campero|pollo gus|tex.?mex|fridays|chilis|applebees|dunkin|starbucks|juan valdez)/.test(txt)) return "Alimentación";
  if (/(cafe\b|cafeteria|cafeto|coffee|heladeria|yogurt|jugos|jugueria|smoothie|panaderia|pasteleria|reposteria|dulceria|confiteria|fruteria|colada|ceviche|mariscos)/.test(txt)) return "Alimentación";
  if (/(tipti|rappi|uber.?eat|glovo|ifood|pedidos.?ya|delivery)/.test(txt)) return "Alimentación";
  if (/(alimento|bebida|lacteo|embutido|carniceria|carnicos|frigorifico|avicola|pesquera|snack|galletas|cereales|harinas|condimento|aceite vegetal|víveres|viveres)/.test(txt)) return "Alimentación";
  if (/(comida|gastronomia|buffet|catering|cocina|almuerzo|desayuno|merienda|menu del dia)/.test(txt)) return "Alimentación";

  // ── Salud ──────────────────────────────────────────────────────────────────
  if (/(farmacia|fybeca|sana.?sana|cruz.?azul|pharmacy|drogueria|botica|medicity)/.test(txt)) return "Salud";
  if (/(clinica|hospital|policlinico|centro medico|consultorio|dispensario|emergencia|sanatorio|policlinica)/.test(txt)) return "Salud";
  if (/(medico|doctor|medicina|atencion medica|consulta medica|servicio medico)/.test(txt)) return "Salud";
  if (/(odontologo|dental|dentista|ortodoncia|endodoncia|periodoncia|odontologia)/.test(txt)) return "Salud";
  if (/(laboratorio clinico|laboratorio medico|laboratorio|rayos.?x|tomografia|resonancia|ecografia|mamografia|radiolog)/.test(txt)) return "Salud";
  if (/(ginecolog|pediatr|cardiol|neurol|psicolog|psiquiatr|nutricion|dietista|fisioterapia|rehabilitacion|ortopedia|traumatolog|oftalm|urolog|dermatolog)/.test(txt)) return "Salud";
  if (/(optica|optometria|lentes|gafas|audiolog|audiofono|audifono|protesis|ortesis)/.test(txt)) return "Salud";
  if (/(metropolitano|de los valles|vozandes|baca ortiz|solca\b|iess\b|clinica pichincha|humanitaria|oncologico)/.test(txt)) return "Salud";
  if (/(salud\b|health|bienestar|wellness|spa\b|masaje|quiropractic|acupuntura|vacuna|vacunacion)/.test(txt)) return "Salud";

  // ── Educación (internet aquí per regla SRI 2024) ──────────────────────────
  if (/(universidad|usfq|puce\b|uce\b|ute\b|udla\b|espe\b|espol\b|flacso|colegio|escuela|academia|instituto\b|politecnica|sede educativa|conservatorio)/.test(txt)) return "Educación";
  if (/(educacion|aprendizaje|capacitacion|formacion|entrenamiento|training|workshop|seminario|congreso|conferencia|e-learning)/.test(txt)) return "Educación";
  if (/(curso|taller|tutoria|coaching|mentoring|maestria|doctorado|posgrado|certificacion|matricula)/.test(txt)) return "Educación";
  if (/(libreria|libro|libros|material escolar|utiles escolares|papeleria|impresion|imprenta|texto escolar)/.test(txt)) return "Educación";
  if (/(idiomas|ingles|frances|aleman|chino|mandarin|lenguaje|linguistica|bilingue)/.test(txt)) return "Educación";
  if (/(internet|netlife|puntonet|speednet|megadatos|openaccess|surnet|fibra optica|banda ancha|wimax)/.test(txt)) return "Educación";
  if (/(arte\b|cultura\b|musica|pintura|teatro|danza|cine\b|museo\b|galeria|ballet|literatura|concierto)/.test(txt)) return "Educación";

  // ── Vestimenta ─────────────────────────────────────────────────────────────
  if (/(de prati|etafashion|eta fashion|tennis\b|marathon sport|buen precio|el bosque\b|la ganga)/.test(txt)) return "Vestimenta";
  if (/(zara\b|h&m|forever 21|pull.?bear|bershka|stradivarius|mango\b|guess\b|tommy hilfiger|calvin klein|levis|wrangler|gap\b|banana republic)/.test(txt)) return "Vestimenta";
  if (/(adidas|nike\b|puma\b|reebok|new balance|under armour|fila\b|converse|vans\b|skechers|hush puppies|jordan)/.test(txt)) return "Vestimenta";
  if (/(ropa\b|vestimenta|indumentaria|confeccion|calzado|zapato|zapatilla|bota\b|sandalia|tenis\b|deportivo|calcetin)/.test(txt)) return "Vestimenta";
  if (/(camisa|pantalon|vestido|falda\b|blusa\b|chaqueta|abrigo|chompa|buzo\b|pijama|ropa interior|lenceria|uniforme)/.test(txt)) return "Vestimenta";
  if (/(tela\b|tejido|costura|modista|sastreria|bordado|boutique|moda\b|fashion|coleccion|corbata|cinturon|cartera|bolso|mochila)/.test(txt)) return "Vestimenta";

  // ── Turismo ────────────────────────────────────────────────────────────────
  if (/(hotel\b|hostal|hosteria|resort|motel\b|lodge\b|posada|hacienda\b|glamping|cabana|pousada)/.test(txt)) return "Turismo";
  if (/(airbnb|booking\b|expedia|trivago|despegar|tripadvisor|vrbo|kayak\b|mistertrip)/.test(txt)) return "Turismo";
  if (/(aerolinea|latam\b|avianca|jetsmart|wingo\b|copa airlines|american airlines|vuelo|aeropuerto|boleto aereo|ticket aereo|pasaje aereo)/.test(txt)) return "Turismo";
  if (/(turismo|tour\b|excursion|aventura|trekking|ecoturismo|agencia de viaje|agencia viaj|crucero|charter|guia turistic)/.test(txt)) return "Turismo";
  if (/(balneario|parque acuatico|parque tematico|parque de diversiones|zoologico|recreacion turistic)/.test(txt)) return "Turismo";

  // ── Vivienda ───────────────────────────────────────────────────────────────
  if (/(claro\b|movistar|cnt\b|directv|tv cable|tvcable|cablevision|dish\b|claro tv|movistar tv|satelite|telefonia)/.test(txt)) return "Vivienda";
  if (/(empresa electrica|luz del sur|centrosur|emelnorte|eersa|cnel\b|eeq\b|emelsig|energia electrica|planilla electrica)/.test(txt)) return "Vivienda";
  if (/(agua potable|epmaps|interagua|aguapen|empresa de agua|empresa municipal agua|etapa\b|planilla agua)/.test(txt)) return "Vivienda";
  if (/(gas domiciliario|gas licuado|tropigas|duragas|zeta gas|congas|renogas|gas natural)/.test(txt)) return "Vivienda";
  if (/(alquiler|arriendo|arrendamiento|inmobilia|bienes raices|administracion de propiedades|renta mensual|cuota condominios|cuota edificio)/.test(txt)) return "Vivienda";
  if (/(ferreteria|materiales de construccion|cemento\b|ladrillo|construccion|plomeria|carpinteria|pintura\b|mantenimiento del hogar|instalacion electrica|gasfiteria)/.test(txt)) return "Vivienda";
  if (/(muebleria|muebles|electrodomestico|refrigerador|lavadora|secadora|horno\b|microondas|colchon|sofa\b|linea blanca|cocina electrica)/.test(txt)) return "Vivienda";
  if (/(vivienda|hogar\b|habitacion|residencia|domicilio|departamento|servicio basico|limpieza del hogar|jardineria|condominio)/.test(txt)) return "Vivienda";

  return "Otros";
}

const CATS = ["Alimentación", "Salud", "Educación", "Vivienda", "Vestimenta", "Turismo", "Otros"] as const;
type Categoria = typeof CATS[number];

// Usa Claude Haiku para categorizar en batch lo que el regex no pudo resolver
async function categorizarConIA(
  items: Array<{ emisor: string; descripciones: string; ruc: string }>
): Promise<Categoria[]> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY || items.length === 0) return items.map(() => "Otros");

  const results: Categoria[] = [];
  const CHUNK = 50; // máx facturas por llamada para no exceder tokens

  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    try {
      const prompt = `Categoriza estas facturas del SRI Ecuador. Para cada una asigna UNA categoría de esta lista exacta: ${CATS.join(", ")}.

Responde SOLO con un JSON array de strings en el mismo orden. Sin texto extra.

Criterios:
- Alimentación: supermercados, restaurantes, comida, bebidas, delivery, panaderías
- Salud: farmacias, hospitales, clínicas, consultas médicas, exámenes, laboratorios, terapias, ópticas, dentistas
- Educación: colegios, universidades, cursos, libros, útiles escolares, internet, arte, cultura, idiomas
- Vivienda: arriendo, luz eléctrica, agua potable, gas, telefonía, cable TV, construcción, ferretería, muebles
- Vestimenta: ropa, zapatos, calzado, accesorios de moda, telas
- Turismo: hoteles, vuelos, tours, agencias de viaje, balnearios, hospedaje
- Otros: gasolina, seguros, notarías, impuestos, municipio, servicios no clasificados

Facturas:
${chunk.map((item, idx) => `${idx + 1}. Emisor: "${item.emisor}", RUC: ${item.ruc}, Desc: "${item.descripciones || "sin descripción"}"`).join("\n")}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || "[]";
      const match = text.match(/\[[\s\S]*\]/);
      const parsed: string[] = match ? JSON.parse(match[0]) : [];

      for (let j = 0; j < chunk.length; j++) {
        const cat = parsed[j] as Categoria;
        results.push(CATS.includes(cat) ? cat : "Otros");
      }
    } catch (e) {
      console.error("Error en categorización IA:", e);
      chunk.forEach(() => results.push("Otros"));
    }
  }

  return results;
}

async function sincronizarUsuario(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  refreshToken: string
): Promise<{ nuevas: number; duplicadas: number; errores: number }> {
  let nuevas = 0, duplicadas = 0, errores = 0;

  const accessToken = await refrescarToken(refreshToken);
  if (!accessToken) return { nuevas: 0, duplicadas: 0, errores: 1 };

  const messageIds = await buscarEmailIds(accessToken);
  console.log(`[${userId}] ${messageIds.length} emails encontrados`);

  // 1. Recopilar y parsear todos los XMLs
  const pendientes: Array<{ emisor: string; ruc: string; fecha: string; monto: number; claveAcceso: string; descripciones: string; categoria: Categoria }> = [];

  for (const msgId of messageIds) {
    try {
      const xmls = await extraerXMLsDelMensaje(accessToken, msgId);
      for (const xml of xmls) {
        const parsed = parsearXML(xml);
        if (!parsed) continue;
        pendientes.push({ ...parsed, categoria: categorizar(parsed.emisor, parsed.descripciones) as Categoria });
      }
    } catch (e) {
      console.error(`Error en mensaje ${msgId}:`, e);
      errores++;
    }
  }

  // 2. Categorizar con IA los que quedaron como "Otros"
  const otrosIdx = pendientes.reduce<number[]>((acc, p, i) => p.categoria === "Otros" ? [...acc, i] : acc, []);
  if (otrosIdx.length > 0) {
    console.log(`[${userId}] Categorizando ${otrosIdx.length} facturas con IA...`);
    const aiCats = await categorizarConIA(otrosIdx.map(i => pendientes[i]));
    otrosIdx.forEach((origIdx, aiIdx) => { pendientes[origIdx].categoria = aiCats[aiIdx]; });
  }

  // 3. Upsert al final con categorías definitivas
  for (const item of pendientes) {
    const { error } = await supabase.from("facturas").upsert(
      {
        user_id: userId,
        emisor: item.emisor,
        ruc: item.ruc,
        fecha: item.fecha,
        monto: item.monto,
        categoria: item.categoria,
        es_deducible_sri: true,
        comprobantes: 1,
        fuente: "gmail",
        clave_acceso: item.claveAcceso || null,
      },
      { onConflict: "user_id,clave_acceso", ignoreDuplicates: true }
    );

    if (error) {
      if (error.code === "23505") duplicadas++;
      else { console.error("Error guardando:", error); errores++; }
    } else {
      nuevas++;
    }
  }

  await supabase
    .from("gmail_tokens")
    .update({ last_sync: new Date().toISOString() })
    .eq("user_id", userId);

  console.log(`[${userId}] Listo: ${nuevas} nuevas, ${duplicadas} duplicadas, ${errores} errores`);
  return { nuevas, duplicadas, errores };
}

// ─── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    let userIds: string[] = [];

    if (body.user_id) {
      // Llamada manual desde la UI — sync solo de este usuario
      userIds = [body.user_id];
    } else {
      // Cron job — todos los usuarios con token
      const { data: tokens, error } = await supabase
        .from("gmail_tokens")
        .select("user_id")
        .not("refresh_token", "is", null);
      if (error) throw error;
      userIds = (tokens || []).map((t: any) => t.user_id);
    }

    console.log(`Sincronizando ${userIds.length} usuario(s)`);
    const resultados = [];

    for (const userId of userIds) {
      const { data: tokenRow } = await supabase
        .from("gmail_tokens")
        .select("refresh_token")
        .eq("user_id", userId)
        .single();

      if (!tokenRow?.refresh_token) continue;

      const resultado = await sincronizarUsuario(supabase, userId, tokenRow.refresh_token);
      resultados.push({ userId, ...resultado });
    }

    return new Response(JSON.stringify({ ok: true, resultados }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e: any) {
    console.error("Error general:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
