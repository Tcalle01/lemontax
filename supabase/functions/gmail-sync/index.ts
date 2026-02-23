// supabase/functions/gmail-sync/index.ts
// Corre cada 12h via cron, o manualmente desde el botón refresh en la UI

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const AÑO = "2025";

// ─── Refrescar access token con refresh token ─────────────────────────────────
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

// ─── Buscar emails con XMLs del SRI en Gmail ──────────────────────────────────
async function buscarEmailIds(accessToken: string): Promise<string[]> {
  const query = `has:attachment (filename:xml OR filename:zip) after:${AÑO}/01/01`;
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=500`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return (data.messages || []).map((m: { id: string }) => m.id);
}

// ─── Descargar un attachment por ID ──────────────────────────────────────────
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

// ─── Extraer XMLs de un ZIP ───────────────────────────────────────────────────
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

// ─── Extraer XMLs de un mensaje de Gmail ─────────────────────────────────────
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

// ─── Parsear XML del SRI ──────────────────────────────────────────────────────
function parsearXML(xmlString: string): any | null {
  try {
    if (xmlString.includes("SharingMessage") || xmlString.includes("<html")) return null;

    let xmlToParse = xmlString;
    const cdataMatch = xmlString.match(/<comprobante[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>/);
    if (cdataMatch) xmlToParse = cdataMatch[1].trim();

    const get = (tag: string) => {
      const m = xmlToParse.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };

    const ruc = get("rucEmisor") || get("ruc");
    const emisor = get("razonSocialEmisor") || get("razonSocial") || get("denominacion") || "Desconocido";
    const fechaEmision = get("fechaEmision");
    const monto = parseFloat(get("importeTotal") || get("valorTotal") || get("total") || "0");
    const claveAcceso = get("claveAcceso") || get("numeroAutorizacion");
    const codDoc = get("codDoc");

    if (!ruc || monto <= 0) return null;
    // Solo facturas, notas de débito/crédito (ignorar otros tipos)
    if (codDoc && !["01", "03", "04", "05", "06", ""].includes(codDoc)) return null;

    // Fecha DD/MM/YYYY → YYYY-MM-DD
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

// ─── Categorizar por emisor y descripción ────────────────────────────────────
function categorizar(emisor: string, descripciones: string): string {
  const txt = `${emisor} ${descripciones}`.toLowerCase();
  if (/supermaxi|coral|megamaxi|aki|tia|santa maria|comisariato|market|supermercado|restaurante|kfc|mcdonalds|burger|pizza|tipti|rappi|uber.?eat|glovo|delivery|frutería|panadería|cafetería|cafe/.test(txt)) return "Alimentación";
  if (/farmacia|clinica|clínica|hospital|medic|doctor|odontolog|dental|optica|laboratorio|salud|cruz.?azul|fybeca|sana.?sana/.test(txt)) return "Salud";
  if (/universidad|colegio|escuela|institute|academia|educacion|curso|libro|librería|útiles|matricula|netlife/.test(txt)) return "Educación";
  if (/zara|h&m|tennis|de prati|etafashion|marathon|adidas|nike|ropa|vestimenta|calzado|zapatos|boutique/.test(txt)) return "Vestimenta";
  if (/hotel|airbnb|hostal|balneario|turismo|tour|agencia.?viaj|booking|expedia|aerolínea|latam|avianca/.test(txt)) return "Turismo";
  if (/luz|agua|internet|claro|cnt|movistar|directv|tv.?cable|alquiler|arriendo|inmobiliaria|ferreteria/.test(txt)) return "Vivienda";
  return "Otros";
}

// ─── Sincronizar facturas de un usuario ──────────────────────────────────────
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

  for (const msgId of messageIds) {
    try {
      const xmls = await extraerXMLsDelMensaje(accessToken, msgId);
      for (const xml of xmls) {
        const parsed = parsearXML(xml);
        if (!parsed) continue;

        const { error } = await supabase.from("facturas").upsert(
          {
            user_id: userId,
            emisor: parsed.emisor,
            ruc: parsed.ruc,
            fecha: parsed.fecha,
            monto: parsed.monto,
            categoria: categorizar(parsed.emisor, parsed.descripciones),
            sri: true,
            comprobantes: 1,
            fuente: "gmail",
            clave_acceso: parsed.claveAcceso || null,
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
    } catch (e) {
      console.error(`Error en mensaje ${msgId}:`, e);
      errores++;
    }
  }

  // Actualizar timestamp último sync
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
    const authHeader = req.headers.get("Authorization");
    let userIds: string[] = [];

    if (authHeader && authHeader.startsWith("Bearer ")) {
      // Llamada manual desde la UI — sync solo del usuario que llama
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: "No autorizado" }), {
          status: 401,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      userIds = [user.id];
    } else {
      // Cron job — procesar todos los usuarios con token guardado
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
