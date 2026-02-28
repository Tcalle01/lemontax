/**
 * Parser browser-side para XMLs de facturas electrónicas emitidas (ventas).
 * Compatible con los 3 formatos del SRI: CDATA, HTML-encoded, XML directo.
 *
 * Retorna los campos necesarios para registrar la venta en Supabase,
 * o null si el XML es inválido o no es una factura (codDoc=01).
 */

function decodHTML(str) {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'");
}

function get(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

export function parsearXMLVenta(xmlText) {
  try {
    let xml = xmlText;

    // Caso 1: CDATA estándar del SRI
    const cdataMatch = xml.match(/<comprobante[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>/);
    if (cdataMatch) {
      xml = cdataMatch[1].trim();
    } else {
      // Caso 2: HTML-encoded (<comprobante>&lt;factura...&gt;</comprobante>)
      const encMatch = xml.match(/<comprobante[^>]*>([\s\S]*?)<\/comprobante>/);
      if (encMatch && encMatch[1].includes("&lt;")) {
        xml = decodHTML(encMatch[1].trim());
      }
      // Caso 3: XML directo (sin wrapper)
    }

    // Solo facturas (codDoc=01); rechazar otros tipos si está presente
    const codDoc = get(xml, "codDoc");
    if (codDoc && codDoc !== "01") return null;

    const ruc = get(xml, "ruc") || get(xml, "rucEmisor");
    const razonSocial =
      get(xml, "razonSocial") ||
      get(xml, "razonSocialEmisor") ||
      get(xml, "denominacion");

    // Número de factura: estab-ptoEmi-secuencial
    const estab = get(xml, "estab");
    const ptoEmi = get(xml, "ptoEmi");
    const secuencial = get(xml, "secuencial");
    const numeroFactura =
      estab && ptoEmi && secuencial ? `${estab}-${ptoEmi}-${secuencial}` : "";

    const claveAcceso =
      get(xml, "claveAcceso") || get(xml, "numeroAutorizacion");

    // Fecha: dd/MM/yyyy → yyyy-MM-dd
    let fechaEmision = get(xml, "fechaEmision");
    if (fechaEmision.includes("/")) {
      const [d, m, y] = fechaEmision.split("/");
      fechaEmision = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // Comprador
    const clienteNombre = get(xml, "razonSocialComprador");
    const clienteRuc = get(xml, "identificacionComprador");

    // Montos
    const totalSinImpuestos = parseFloat(get(xml, "totalSinImpuestos") || "0");
    const importeTotal = parseFloat(
      get(xml, "importeTotal") || get(xml, "valorTotal") || "0"
    );

    // Tarifa IVA (puede haber múltiples, tomamos el mayor)
    const tarifas = [...xml.matchAll(/<tarifa>([^<]+)<\/tarifa>/gi)].map((m) =>
      parseFloat(m[1])
    );
    const tarifaIva = tarifas.length > 0 ? Math.max(...tarifas) : 0;

    // Descripciones de ítems de detalle
    const descripciones = [...xml.matchAll(/<descripcion>([^<]+)<\/descripcion>/gi)]
      .map((m) => m[1].trim())
      .filter(Boolean)
      .join(", ");

    if (!ruc || totalSinImpuestos <= 0) return null;

    return {
      emisor: razonSocial,
      ruc,
      fecha: fechaEmision,
      numeroFactura,
      claveAcceso,
      clienteNombre,
      clienteRuc,
      subtotal: totalSinImpuestos,
      tarifaIva,
      total: importeTotal || totalSinImpuestos * (1 + tarifaIva / 100),
      descripcion: descripciones,
    };
  } catch {
    return null;
  }
}
