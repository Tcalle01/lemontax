// gmailImport.js — Importación completa de facturas SRI desde Gmail
import JSZip from "jszip";

const CLIENT_ID = "368032133424-mbo5r3sh4mdrrl8npkf3gbuk5n4edb2h.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/gmail.readonly";
const AÑO = "2025";

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

// ─── Queries de búsqueda — simple y efectivo ─────────────────────────────────
const SEARCH_QUERIES = [
  // Todo correo con XML adjunto en 2025
  `has:attachment filename:xml after:${AÑO}/01/01 before:${AÑO}/12/31`,
  // Todo correo con ZIP adjunto en 2025 (muchos emisores mandan XML dentro de ZIP)
  `has:attachment filename:zip after:${AÑO}/01/01 before:${AÑO}/12/31`,
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
    const doc = parser.parseFromString(xmlString, "text/xml");

    // Verificar que sea un comprobante SRI válido
    // 01 = Factura, 03 = Liquidación, 04 = Nota de crédito, 05 = Nota de débito
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

    // Extraer descripción de los artículos/servicios del detalle
    const descripciones = Array.from(doc.querySelectorAll("detalle descripcion, detalle descripcionAdicional, detAdicional"))
      .map(el => el.textContent?.trim() || "")
      .filter(Boolean)
      .join(" ");

    const categoria = categorizar(razonSocial, descripciones);

    return {
      id: claveAcceso || `gmail-${ruc}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emisor: razonSocial || "Desconocido",
      ruc,
      fecha: fechaFormateada,
      monto: importeTotal,
      categoria,
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

  if (/MEDICINA|MEDICAMENTO|FARMACO|CONSULTA MEDICA|CONSULTA|CIRUGIA|EXAMEN|LABORATORIO|RAYOS X|ECOGRAFIA|VACUNA|TERAPIA|LENTES|GAFAS|AUDIFONOS/.test(t))
    return "Salud";
  if (/ARROZ|ACEITE|LECHE|PAN|CARNE|POLLO|PESCADO|FRUTA|VERDURA|VEGETAL|HUEVO|AZUCAR|SAL|HARINA|PASTA|FIDEO|ATUN|SARDINA|QUESO|YOGURT|MANTEQUILLA|CEREAL|GRANOLA|CAFE|TE\b|JUGO|REFRESCO|AGUA|COMIDA|ALIMENTO|VÍVERES|VIVERES/.test(t))
    return "Alimentación";
  if (/ALMUERZO|DESAYUNO|MERIENDA|MENU|PLATO|HAMBURGUES|PIZZA|SUSHI|TACOS|SANDWICH|ENSALADA|HELADO|POSTRE|BEBIDA/.test(t))
    return "Alimentación";
  if (/COLEGIATURA|PENSION EDUCATIVA|PENSION ESCOLAR|MATRICULA|CURSO|TALLER|SEMINARIO|CAPACITACION|LIBRO|TEXTO|CUADERNO|UTILES|MATERIAL EDUCATIVO|CLASE|LECCION|TUTORIA/.test(t))
    return "Educación";
  if (/CAMISA|PANTALON|ZAPATO|ZAPATILLA|VESTIDO|FALDA|CHOMPA|CHAQUETA|ABRIGO|ROPA|CALCETIN|INTERIORES|CORBATA|CINTURON|CARTERA|BOLSO|MOCHILA/.test(t))
    return "Vestimenta";
  if (/ARRIENDO|ALQUILER|RENTA|HIPOTECA|MANTENIMIENTO EDIFICIO|ADMINISTRACION EDIFICIO|CUOTA CONDOMINIO/.test(t))
    return "Vivienda";
  if (/PASAJE|TIQUETE|TICKET AEREO|HOTEL|HOSPEDAJE|TOUR|EXCURSION|PAQUETE TURISTICO|CRUCERO/.test(t))
    return "Turismo";
  if (/GASOLINA|DIESEL|GAS|COMBUSTIBLE|PEAJE|LAVADO AUTO|PARQUEADERO|PARKING|ESTACIONAMIENTO/.test(t))
    return "Transporte";
  if (/PLAN CELULAR|PLAN MOVIL|INTERNET|TELEFONIA|STREAMING|SUSCRIPCION|PLATAFORMA|SERVICIO DIGITAL/.test(t))
    return "Servicios";

  return null;
}

// ─── Categorización solo por nombre del emisor ───────────────────────────────
function categorizarEmisor(nombre = "") {
  const n = normalizar(nombre);

  if (/FARMA|CLINICA|CLINIC|HOSPITAL|MEDIC|SALUD|DOCTOR|ODONTO|OPTICA|LABORAT|BIOMEDIC|DERMATO|PSICO/.test(n))
    return "Salud";
  if (/SUPERMAXI|MEGAMAXI|TIA\b|CORAL|AKI|SANTA MARIA|GRAN AKI|HIPERMARKET|DESPENSA|SUPERMARKET|MARKET|SUPERMERCADO/.test(n))
    return "Alimentación";
  if (/RESTAURAN|PIZZA|BURGER|KFC|MCDON|SUBWAY|SUSHI|CAFE|CAFETERIA|COMIDA|FRITAD|CEVICH|POLLOS|ASADERO|HELADERIA/.test(n))
    return "Alimentación";
  if (/SHELL|PRIMAX|PETROCOMERCIAL|GASOLINA|GASOLINERA|COMBUSTIBL|PETROECUADOR|TERPEL|ESTACION DE SERVICIO/.test(n))
    return "Transporte";
  if (/UBER|CABIFY|INDRIVER|TAXI|TRANSPORTE PUBLICO|COOPERATIVA DE TRANSPORTE/.test(n))
    return "Transporte";
  if (/LIBRERIA|COLEGIO|ESCUELA|UNIVERSIDAD|ACADEM|INSTITUTO|EDUCACION|CURSO|TALLER|CAPACIT|IDIOMAS|CULTURA|ARTE/.test(n))
    return "Educación";
  if (/DE PRATI|ETAFASHION|ZARA|H&M|ROPA|VESTIM|CALZADO|TENNIS|BANANA|CREDITO|MODA|FASHION/.test(n))
    return "Vestimenta";
  if (/HOTEL|HOSTAL|AIRBNB|VIAJE|AGENCIA DE VIAJE|AEROLIN|AIRLINE|AVIANCA|LATAM|COPA AIR|JETBLUE|AMERICAN/.test(n))
    return "Turismo";
  if (/ARREND|ALQUIL|INMOBIL|CONDOMINIO|EDIFICIO|CONJUNTO RESIDENCIAL/.test(n))
    return "Vivienda";
  if (/CLARO|MOVISTAR|CNT|INTERNET|CELULAR|TELECOM|TV CABLE|DIRECTV|NETFLIX|SPOTIFY|AMAZON|CABLE/.test(n))
    return "Servicios";

  return "Otros";
}

// ─── Procesar un mensaje: extrae todas las facturas de sus adjuntos ───────────
async function procesarMensaje(token, messageId) {
  const facturas = [];
  const mensaje = await getMensaje(token, messageId);
  if (!mensaje) return facturas;

  const partes = obtenerPartes(mensaje.payload);

  for (const parte of partes) {
    if (!parte.body?.attachmentId) continue;
    const nombre = parte.filename?.toLowerCase() || "";

    // Caso 1: XML directo
    if (nombre.endsWith(".xml") || parte.mimeType?.includes("xml")) {
      try {
        const xml = await getAdjuntoTexto(token, messageId, parte.body.attachmentId);
        const factura = parsearXML(xml);
        if (factura) facturas.push(factura);
      } catch (e) { /* ignorar */ }
    }

    // Caso 2: ZIP con XMLs adentro
    if (nombre.endsWith(".zip") || parte.mimeType?.includes("zip")) {
      try {
        const bytes = await getAdjuntoBytes(token, messageId, parte.body.attachmentId);
        const xmls = await extraerXMLsDeZip(bytes);
        for (const xml of xmls) {
          const factura = parsearXML(xml);
          if (factura) facturas.push(factura);
        }
      } catch (e) { /* ignorar */ }
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
