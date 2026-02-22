// gmailImport.js — Importación de facturas electrónicas SRI desde Gmail

const CLIENT_ID = "368032133424-mbo5r3sh4mdrrl8npkf3gbuk5n4edb2h.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/gmail.readonly";

// ─── Cargar Google Identity Services ─────────────────────────────────────────
function loadGoogleScript() {
  return new Promise((resolve) => {
    if (window.google) return resolve();
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

// ─── Buscar correos con facturas SRI ─────────────────────────────────────────
async function buscarMensajes(token) {
  // Busca correos con XML adjunto que sean facturas electrónicas del SRI
  const query = encodeURIComponent(
    'has:attachment filename:xml (factura OR "comprobante electrónico" OR "RIDE" OR sri.gob.ec)'
  );
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Error al conectar con Gmail");
  const data = await res.json();
  return data.messages || [];
}

// ─── Obtener detalle de un mensaje ───────────────────────────────────────────
async function getMensaje(token, id) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

// ─── Descargar adjunto ───────────────────────────────────────────────────────
async function getAdjunto(token, messageId, attachmentId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  // Gmail devuelve base64url, lo convertimos a texto
  const base64 = data.data.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

// ─── Parsear XML de factura SRI ───────────────────────────────────────────────
function parsearXML(xmlString) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");

    // Extraer datos del comprobante electrónico SRI
    const get = (tag) => doc.querySelector(tag)?.textContent?.trim() || "";

    const ruc = get("rucEmisor") || get("ruc");
    const razonSocial = get("razonSocialEmisor") || get("razonSocial");
    const fechaEmision = get("fechaEmision");
    const totalSinImpuestos = parseFloat(get("totalSinImpuestos") || get("subtotal") || "0");
    const importeTotal = parseFloat(get("importeTotal") || get("total") || totalSinImpuestos.toString());

    if (!ruc || importeTotal <= 0) return null;

    // Categorización automática por razón social
    const categoria = categorizarEmisor(razonSocial);

    // Formatear fecha
    let fechaFormateada = fechaEmision;
    if (fechaEmision && fechaEmision.includes("/")) {
      const [d, m, y] = fechaEmision.split("/");
      const meses = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      fechaFormateada = `${d} ${meses[parseInt(m)]} ${y}`;
    }

    return {
      id: `gmail-${ruc}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emisor: razonSocial || "Desconocido",
      ruc,
      fecha: fechaFormateada || fechaEmision,
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

// ─── Categorización automática ────────────────────────────────────────────────
function categorizarEmisor(nombre = "") {
  const n = nombre.toUpperCase();

  if (/FARMA|CLINICA|CLINIC|HOSPITAL|MEDIC|SALUD|DOCTOR|ODONTO|OPTICA|LABORAT/.test(n))
    return "Salud";
  if (/SUPERMAXI|TIA|CORAL|AKÍ|AKI|MEGAMAXI|SANTA MARIA|GRAN AKI|HIPERMARKET|DESPENSA|SUPERMARKET|MARKET/.test(n))
    return "Alimentación";
  if (/RESTAURAN|PIZZA|BURGER|KFC|MCDON|SUBWAY|SUSHI|CAFÉ|CAFE|COMIDA|FRITAD|CEVICH/.test(n))
    return "Alimentación";
  if (/SHELL|PRIMAX|PETROCOMERCIAL|GASOLINA|GASOLINERA|COMBUSTIBL|PETROECUADOR|TERPEL/.test(n))
    return "Transporte";
  if (/UBER|CABIFY|INDRIVER|TAXI|BUS|METRO|TROLE/.test(n))
    return "Transporte";
  if (/LIBRERIA|LIBRER|COLEGIO|ESCUELA|UNIVERSIDAD|ACADEM|INSTITUTO|EDUCACION|CURSO|TALLER|CAPACIT/.test(n))
    return "Educación";
  if (/DE PRATI|ETAFASHION|ZARA|H&M|ROPA|VESTIM|CALZADO|TENNIS|BANANA|CREDITO|MODA/.test(n))
    return "Vestimenta";
  if (/HOTEL|HOSTAL|AIRBNB|VIAJE|AGENCIA|AEROLIN|AIRLINE|AVIANCA|LATAM|COPA|JET/.test(n))
    return "Turismo";
  if (/ARREND|ALQUIL|INMOBIL|URBAN|EDIFICIO/.test(n))
    return "Vivienda";
  if (/CLARO|MOVISTAR|CNT|INTERNET|CELULAR|TELECOM|TV CABLE|DIRECTV|NETFLIX/.test(n))
    return "Servicios";

  return "Otros";
}

// ─── Función principal de importación ────────────────────────────────────────
export async function importarDesdeGmail(onProgress) {
  const token = await getGmailToken();

  onProgress({ step: "buscando", mensaje: "Buscando correos con facturas SRI..." });

  const mensajes = await buscarMensajes(token);

  if (mensajes.length === 0) {
    return { facturas: [], total: 0, mensaje: "No se encontraron facturas electrónicas en tu Gmail" };
  }

  onProgress({ step: "procesando", mensaje: `Encontrados ${mensajes.length} correos. Procesando...`, total: mensajes.length });

  const facturasImportadas = [];
  const errores = [];

  for (let i = 0; i < mensajes.length; i++) {
    try {
      onProgress({ step: "procesando", mensaje: `Procesando ${i + 1} de ${mensajes.length}...`, actual: i + 1, total: mensajes.length });

      const mensaje = await getMensaje(token, mensajes[i].id);
      const partes = obtenerPartes(mensaje.payload);

      for (const parte of partes) {
        if (!parte.filename?.endsWith(".xml") && !parte.mimeType?.includes("xml")) continue;
        if (!parte.body?.attachmentId) continue;

        const xml = await getAdjunto(token, mensajes[i].id, parte.body.attachmentId);
        const factura = parsearXML(xml);
        if (factura) facturasImportadas.push(factura);
      }
    } catch (e) {
      errores.push(mensajes[i].id);
    }
  }

  // Deduplicar por RUC + monto + fecha
  const unicas = facturasImportadas.filter((f, i, arr) =>
    arr.findIndex(x => x.ruc === f.ruc && x.monto === f.monto && x.fecha === f.fecha) === i
  );

  onProgress({ step: "listo", mensaje: `${unicas.length} facturas importadas`, actual: unicas.length, total: unicas.length });

  return {
    facturas: unicas,
    total: unicas.length,
    errores: errores.length,
    mensaje: `Se importaron ${unicas.length} facturas nuevas`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function obtenerPartes(payload, resultado = []) {
  if (!payload) return resultado;
  if (payload.filename && payload.body) resultado.push(payload);
  if (payload.parts) payload.parts.forEach(p => obtenerPartes(p, resultado));
  return resultado;
}
