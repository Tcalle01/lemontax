// gmailImport.js — Importación completa de facturas SRI desde Gmail
import JSZip from "jszip";

const CLIENT_ID = "368032133424-mbo5r3sh4mdrrl8npkf3gbuk5n4edb2h.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/gmail.readonly";
const AÑO = String(new Date().getFullYear());

// ─── Cargar Google Identity Services ─────────────────────────────────────────
function loadGoogleScript() {
  return new Promise((resolve) => {
    if (window.google?.accounts) return resolve();
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

// ─── Obtener token OAuth ──────────────────────────────────────────────────────
export async function getGmailToken() {
  await loadGoogleScript();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) return reject(new Error(response.error));
        resolve(response.access_token);
      },
    });
    client.requestAccessToken();
  });
}

// ─── Queries de búsqueda ─────────────────────────────────────────────────────
const SEARCH_QUERIES = [
  `xml after:${AÑO}/01/01 before:${AÑO}/12/31`,
];

// ─── Buscar todos los mensajes de un query con paginación ─────────────────────
async function buscarTodos(token, query) {
  const mensajes = [];
  let pageToken = null;

  do {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", "500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) break;

    const data = await res.json();
    if (data.messages) mensajes.push(...data.messages);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return mensajes;
}

// ─── Obtener detalle de un mensaje ───────────────────────────────────────────
async function getMensaje(token, id) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  return res.json();
}

// ─── Descargar adjunto como bytes ─────────────────────────────────────────────
async function getAdjuntoBytes(token, messageId, attachmentId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const base64 = data.data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Descargar adjunto como texto ────────────────────────────────────────────
async function getAdjuntoTexto(token, messageId, attachmentId) {
  const bytes = await getAdjuntoBytes(token, messageId, attachmentId);
  return new TextDecoder("utf-8").decode(bytes);
}

// ─── Extraer XMLs de un ZIP ───────────────────────────────────────────────────
async function extraerXMLsDeZip(bytes) {
  const xmlTextos = [];
  try {
    const zip = await JSZip.loadAsync(bytes);
    const archivos = Object.values(zip.files).filter(
      f => !f.dir && f.name.toLowerCase().endsWith(".xml")
    );
    for (const archivo of archivos) {
      const texto = await archivo.async("text");
      xmlTextos.push(texto);
    }
  } catch (e) {
    // No era un ZIP válido, ignorar
  }
  return xmlTextos;
}

// ─── Parsear XML de factura SRI ───────────────────────────────────────────────
function parsearXML(xmlString) {
  try {
    const parser = new DOMParser();
    let doc = parser.parseFromString(xmlString, "text/xml");

    // El SRI envuelve el comprobante en <autorizacion><comprobante><![CDATA[...]]></comprobante></autorizacion>
    // Hay que extraer el XML interno del CDATA y parsearlo por separado
    const nodoComprobante = doc.querySelector("autorizacion comprobante");
    if (nodoComprobante) {
      const xmlInterno = nodoComprobante.textContent?.trim();
      if (xmlInterno) {
        doc = parser.parseFromString(xmlInterno, "text/xml");
      }
    }

    // Verificar que sea comprobante SRI válido
    const tipoComprobante = doc.querySelector("codDoc")?.textContent?.trim();
    if (tipoComprobante && !["01", "03", "04", "05"].includes(tipoComprobante)) return null;

    const get = (tag) => doc.querySelector(tag)?.textContent?.trim() || "";

    const ruc = get("rucEmisor") || get("ruc");
    const razonSocial = get("razonSocialEmisor") || get("razonSocial") || get("denominacion");
    const fechaEmision = get("fechaEmision");
    const importeTotal = parseFloat(
      get("importeTotal") || get("valorTotal") || get("total") || "0"
    );
    const claveAcceso = get("claveAcceso") || get("numeroAutorizacion");

    if (!ruc || importeTotal <= 0) return null;

    // Formatear fecha DD/MM/YYYY → YYYY-MM-DD
    let fechaFormateada = fechaEmision;
    if (fechaEmision?.includes("/")) {
      const [d, m, y] = fechaEmision.split("/");
      fechaFormateada = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // Solo facturas de 2025
    if (!fechaFormateada?.startsWith(AÑO)) return null;

    // Extraer descripciones de artículos para categorización
    const descripciones = Array.from(
      doc.querySelectorAll("detalle descripcion, detalle descripcionAdicional, detAdicional")
    ).map(el => el.textContent?.trim() || "").filter(Boolean).join(" ");

    return {
      id: claveAcceso || `gmail-${ruc}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emisor: razonSocial || "Desconocido",
      ruc,
      fecha: fechaFormateada,
      monto: importeTotal,
      categoria: categorizar(razonSocial, descripciones),
      sri: true,
      comprobantes: 1,
      fuente: "gmail",
    };
  } catch (e) {
    return null;
  }
}

// ─── Categorización: emisor + artículos ──────────────────────────────────────
function normalizar(texto = "") {
  return texto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function categorizar(emisor = "", articulos = "") {
  // Primero intentar con el nombre del emisor (más confiable)
  const catEmisor = categorizarEmisor(emisor);
  if (catEmisor !== "Otros") return catEmisor;

  // Si no se pudo determinar por emisor, usar los artículos
  return categorizarArticulos(articulos) || "Otros";
}

function categorizarArticulos(texto = "") {
  const t = normalizar(texto);

  // Salud
  if (/MEDICINA|MEDICAMENTO|FARMACO|CONSULTA MEDICA|CIRUGIA|EXAMEN MEDICO|LABORATORIO|RAYOS X|ECOGRAFIA|TOMOGRAFIA|RESONANCIA|MAMOGRAFIA|VACUNA|TERAPIA|LENTES|GAFAS|AUDIFONOS|PROTESIS|ORTESIS/.test(t))
    return "Salud";

  // Alimentación — artículos primero (más específico que categoría)
  if (/ARROZ|ACEITE|LECHE|PAN\b|CARNE|POLLO|PESCADO|FRUTA|VERDURA|VEGETAL|HUEVO|AZUCAR|SAL\b|HARINA|PASTA|FIDEO|ATUN|SARDINA|QUESO|YOGURT|MANTEQUILLA|CEREAL|GRANOLA|CAFE\b|TE\b|JUGO|REFRESCO|ALIMENTO|VIVERES|LACTEO|EMBUTIDO|CONDIMENTO|VINAGRE|MAYONESA/.test(t))
    return "Alimentación";
  if (/ALMUERZO|DESAYUNO|MERIENDA|MENU|PLATO|HAMBURGUES|PIZZA|SUSHI|TACOS|SANDWICH|ENSALADA|HELADO|POSTRE|BEBIDA|SNACK|GALLETAS|COMIDA|CEVICHE|MARISCOS|CATERING/.test(t))
    return "Alimentación";

  // Educación (internet = Educación per SRI 2024)
  if (/COLEGIATURA|PENSION EDUCATIVA|PENSION ESCOLAR|MATRICULA|CURSO|TALLER|SEMINARIO|CAPACITACION|LIBRO|TEXTO|CUADERNO|UTILES|MATERIAL EDUCATIVO|CLASE|LECCION|TUTORIA|CERTIFICACION|INSCRIPCION CURSO/.test(t))
    return "Educación";
  if (/INTERNET|FIBRA OPTICA|BANDA ANCHA|SERVICIO INTERNET|PLAN INTERNET/.test(t))
    return "Educación";
  if (/ARTE|CULTURA|MUSICA|PINTURA|TEATRO|DANZA|CONCIERTO|ENTRADA MUSEO|ENTRADA CINE/.test(t))
    return "Educación";

  // Vestimenta
  if (/CAMISA|PANTALON|ZAPATO|ZAPATILLA|VESTIDO|FALDA|CHOMPA|CHAQUETA|ABRIGO|ROPA\b|CALCETIN|INTERIORES|CORBATA|CINTURON|CARTERA|BOLSO|MOCHILA|TELA|UNIFORME|BLUSA|LENCERIA/.test(t))
    return "Vestimenta";

  // Vivienda
  if (/ARRIENDO|ALQUILER|RENTA\b|HIPOTECA|MANTENIMIENTO EDIFICIO|ADMINISTRACION EDIFICIO|CUOTA CONDOMINIO|PLANILLA ELECTRICA|PLANILLA AGUA|GAS DOMICILIARIO|SERVICIO BASICO/.test(t))
    return "Vivienda";
  if (/MATERIALES DE CONSTRUCCION|FERRETERIA|CEMENTO|LADRILLO|PINTURA|PLOMERIA|CARPINTERIA|ELECTRODOMESTICO|MUEBLE|COLCHON/.test(t))
    return "Vivienda";

  // Turismo
  if (/PASAJE|TIQUETE|TICKET AEREO|HOTEL|HOSPEDAJE|TOUR\b|EXCURSION|PAQUETE TURISTICO|CRUCERO|VUELO|BOLETO AEREO|ALOJAMIENTO/.test(t))
    return "Turismo";

  // Gasolina y transporte → Otros (no es categoría SRI deducible directamente)
  if (/GASOLINA|DIESEL|COMBUSTIBLE|PEAJE|LAVADO AUTO|PARQUEADERO|ESTACIONAMIENTO/.test(t))
    return "Otros";

  return null;
}

// ─── Categorización solo por nombre del emisor ───────────────────────────────
function categorizarEmisor(nombre = "") {
  const n = normalizar(nombre);

  // Salud
  if (/FARMA|CLINICA|CLINIC|HOSPITAL|MEDIC|SALUD|DOCTOR|ODONTO|OPTICA|LABORAT|BIOMEDIC|DERMATO|PSICO|FISIO|REHAB|QUIROPRACT|NUTRIC|GINECOL|PEDIATR|CARDIOL|NEUROL|UROLOG|OFTALM/.test(n))
    return "Salud";

  // Alimentación — cadenas de supermercados y restaurantes Ecuador
  if (/SUPERMAXI|MEGAMAXI|GRAN AKI|MEDIANO AKI|SALUDMARKET|REPOSTA|COMISARIATO|HIPERMERCADO|SUPERMERCADO|MINIMARKET|AUTOSERVICIO|SUPERBODEGA/.test(n))
    return "Alimentación";
  if (/TIA\b|AKI\b|SANTA MARIA\b|CORAL\b|LA FAVORITA|PRONACA|DIPASO|SUPERDELIS|DISCO\b/.test(n))
    return "Alimentación";
  if (/RESTAURAN|PIZZA|BURGER|KFC\b|MCDON|SUBWAY|SUSHI|CAFE\b|CAFETERIA|COMIDA|FRITAD|CEVICH|POLLOS|ASADERO|HELADERIA|PANADERIA|PASTELERIA|TIPTI|RAPPI|GLOVO|DELIVERY|CHIFA\b|MARISQUERIA|FRUTERIA/.test(n))
    return "Alimentación";
  if (/STARBUCKS|JUAN VALDEZ|POLLO CAMPERO|POLLO GUS|BURGER KING|PIZZA HUT|DOMINOS|PAPA JOHN|FRIDAYS|CHILIS/.test(n))
    return "Alimentación";

  // Educación
  if (/LIBRERIA|COLEGIO|ESCUELA|UNIVERSIDAD|ACADEM|INSTITUTO\b|EDUCACION|CAPACIT|IDIOMAS|CULTURA|ARTE\b|CONSERVATORIO|POLITECNICA|USFQ|PUCE\b|UCE\b|UTE\b|UDLA|ESPE\b|ESPOL|FLACSO/.test(n))
    return "Educación";
  if (/NETLIFE|PUNTONET|SPEEDNET|MEGADATOS|OPENACCESS|SURNET/.test(n))
    return "Educación";

  // Vestimenta
  if (/DE PRATI|ETAFASHION|ZARA\b|H&M|ROPA\b|VESTIM|CALZADO|TENNIS\b|MODA\b|FASHION|MARATHON SPORT|ADIDAS|NIKE\b|PUMA\b|REEBOK|CONVERSE|SKECHERS|BOUTIQUE/.test(n))
    return "Vestimenta";

  // Turismo
  if (/HOTEL\b|HOSTAL|HOSTERIA|RESORT|AIRBNB|AGENCIA DE VIAJE|AGENCIA VIAJ|AEROLIN|AIRLINE|AVIANCA|LATAM\b|COPA AIR|JETSMART|WINGO\b|BALNEARIO|TURISMO|TOUR\b|ECOTURISMO/.test(n))
    return "Turismo";

  // Vivienda
  if (/ARREND|ALQUIL|INMOBIL|CONDOMINIO|CONJUNTO RESIDENCIAL|EMPRESA ELECTRICA|LUZ DEL SUR|CENTROSUR|EMELNORTE|CNEL\b|EEQ\b|EPMAPS|INTERAGUA|AGUAPEN|ETAPA\b|TROPIGAS|DURAGAS|ZETA GAS|FERRETERIA/.test(n))
    return "Vivienda";
  if (/CLARO\b|MOVISTAR|CNT\b|DIRECTV|TV CABLE|TVCABLE|CABLEVISION|DISH\b|TELEFONIA/.test(n))
    return "Vivienda";

  return "Otros";
}

// ─── Procesar un mensaje: extrae todas las facturas de sus adjuntos ───────────
async function procesarMensaje(token, messageId) {
  const facturas = [];
  const mensaje = await getMensaje(token, messageId);
  if (!mensaje) return facturas;

  const partes = obtenerPartes(mensaje.payload);

  // DEBUG: mostrar todos los adjuntos encontrados
  partes.forEach(p => {
    if (p.body?.attachmentId) {
      console.log(`[LemonTax] Adjunto: filename="${p.filename}" mimeType="${p.mimeType}" size=${p.body?.size}`);
    }
  });

  const partesRelevantes = partes.filter(p => {
    if (!p.body?.attachmentId) return false;
    const nombre = p.filename?.toLowerCase() || "";
    const mime = p.mimeType?.toLowerCase() || "";
    return (
      nombre.endsWith(".xml") ||
      nombre.endsWith(".zip") ||
      mime.includes("xml") ||
      mime.includes("zip") ||
      mime.includes("x-zip") ||
      /^\d{3}-\d{3}-\d{9}/.test(nombre)
    );
  });

  console.log(`[LemonTax] Mensaje ${messageId}: ${partes.filter(p=>p.body?.attachmentId).length} adjuntos totales, ${partesRelevantes.length} relevantes`);

  if (partesRelevantes.length === 0) return facturas;

  for (const parte of partesRelevantes) {
    const nombre = parte.filename?.toLowerCase() || "";
    const mime = parte.mimeType?.toLowerCase() || "";

    // Caso 1: XML directo (incluyendo .XML en mayúsculas)
    if (nombre.endsWith(".xml") || mime.includes("xml") || /^\d{3}-\d{3}-\d{9}/.test(nombre)) {
      try {
        const xml = await getAdjuntoTexto(token, messageId, parte.body.attachmentId);
        // DEBUG: mostrar primeros 300 chars del XML para diagnosticar
        console.log(`[LemonTax] XML raw (${parte.filename}):`, xml.substring(0, 300));
        const factura = parsearXML(xml);
        console.log(`[LemonTax] XML parseado:`, factura ? `✓ ${factura.emisor} $${factura.monto}` : "✗ no válido");
        if (factura) facturas.push(factura);
      } catch (e) { console.log(`[LemonTax] Error XML:`, e.message); }
    }

    if (nombre.endsWith(".zip") || mime.includes("zip")) {
      try {
        const bytes = await getAdjuntoBytes(token, messageId, parte.body.attachmentId);
        const xmls = await extraerXMLsDeZip(bytes);
        console.log(`[LemonTax] ZIP: ${xmls.length} XMLs encontrados adentro`);
        for (const xml of xmls) {
          const factura = parsearXML(xml);
          if (factura) facturas.push(factura);
        }
      } catch (e) { console.log(`[LemonTax] Error ZIP:`, e.message); }
    }
  }

  return facturas;
}

// ─── Función principal de importación ────────────────────────────────────────
export async function importarDesdeGmail(onProgress) {
  const token = await getGmailToken();

  onProgress({ step: "buscando", mensaje: "Buscando correos con facturas SRI...", actual: 0, total: 0 });

  // Ejecutar las 5 búsquedas en paralelo y deduplicar por ID de mensaje
  const resultados = await Promise.all(
    SEARCH_QUERIES.map(q => buscarTodos(token, q).catch(() => []))
  );

  const mapaIds = new Map();
  resultados.flat().forEach(m => mapaIds.set(m.id, m));
  const mensajesUnicos = Array.from(mapaIds.values());

  if (mensajesUnicos.length === 0) {
    return {
      facturas: [],
      total: 0,
      mensaje: "No se encontraron correos con facturas en 2025. Verifica que los correos lleguen a este Gmail.",
    };
  }

  onProgress({
    step: "procesando",
    mensaje: `${mensajesUnicos.length} correos encontrados. Extrayendo XMLs...`,
    actual: 0,
    total: mensajesUnicos.length,
  });

  const facturasRaw = [];
  const BATCH = 5; // 5 en paralelo para no saturar la API de Gmail

  for (let i = 0; i < mensajesUnicos.length; i += BATCH) {
    const lote = mensajesUnicos.slice(i, i + BATCH);
    const resultadosLote = await Promise.all(
      lote.map(m => procesarMensaje(token, m.id).catch(() => []))
    );
    resultadosLote.flat().forEach(f => facturasRaw.push(f));

    onProgress({
      step: "procesando",
      mensaje: `Extrayendo facturas... ${Math.min(i + BATCH, mensajesUnicos.length)} de ${mensajesUnicos.length} correos`,
      actual: Math.min(i + BATCH, mensajesUnicos.length),
      total: mensajesUnicos.length,
    });
  }

  // Deduplicar facturas: usar claveAcceso si existe, si no por ruc+monto+fecha
  const vistas = new Set();
  const facturasUnicas = facturasRaw.filter(f => {
    const key = f.id.startsWith("gmail-")
      ? `${f.ruc}-${f.monto}-${f.fecha}`
      : f.id;
    if (vistas.has(key)) return false;
    vistas.add(key);
    return true;
  });

  // Ordenar por fecha descendente
  facturasUnicas.sort((a, b) => b.fecha.localeCompare(a.fecha));

  onProgress({
    step: "listo",
    mensaje: `¡Listo! ${facturasUnicas.length} facturas importadas`,
    actual: facturasUnicas.length,
    total: facturasUnicas.length,
  });

  return {
    facturas: facturasUnicas,
    total: facturasUnicas.length,
    mensaje: `${facturasUnicas.length} facturas encontradas en ${mensajesUnicos.length} correos revisados`,
  };
}

// ─── Helper: recorre recursivamente todas las partes del mensaje ──────────────
function obtenerPartes(payload, resultado = []) {
  if (!payload) return resultado;
  if (payload.filename && payload.body?.attachmentId) resultado.push(payload);
  if (payload.parts) payload.parts.forEach(p => obtenerPartes(p, resultado));
  return resultado;
}
