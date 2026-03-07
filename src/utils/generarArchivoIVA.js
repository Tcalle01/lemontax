/**
 * Generador de archivos XML y JSON para subir al portal SRI en línea.
 * Formulario 104 (mensual) y 104-A (semestral) — Declaración de IVA.
 *
 * Formato basado en la "Guía para contribuyentes: Elaboración del archivo XML o JSON
 * para la declaración del Impuesto al Valor Agregado - IVA" del SRI.
 *
 * La Tabla 1 de la guía define la conversión Casillero → Concepto.
 * Solo se incluyen conceptos con valor > 0 (regla SRI: no incluir casilleros vacíos).
 *
 * Convención de montos recibidos:
 *   - totalVentasGravadas: base sin IVA de ventas al 15% (monto de facturas es_venta=true)
 *   - ivaVentas: IVA cobrado = totalVentasGravadas * 15%
 *   - totalVentasCero: base de ventas tarifa 0%
 *   - totalCompras: total CON IVA de compras (monto de facturas Gmail)
 *   - ivaCompras: IVA pagado = totalCompras * 15/115
 */

/** Formatea número como string con 2 decimales (punto decimal, sin separador de miles). */
function fmt(n) {
  return parseFloat(n || 0).toFixed(2);
}

/**
 * Construye el mapa concepto → valor para el formulario 104/104-A.
 * Devuelve solo los conceptos con valor > 0.
 *
 * @param {object} p
 * @param {number} p.totalVentasGravadas  Base sin IVA de ventas gravadas al 15%
 * @param {number} p.ivaVentas            IVA cobrado a clientes (totalVentasGravadas * 15%)
 * @param {number} p.totalVentasCero      Base de ventas tarifa 0%
 * @param {number} p.totalCompras         Total CON IVA de compras (Gmail monto)
 * @param {number} p.ivaCompras           IVA pagado = totalCompras * 15/115
 * @returns {Record<string,string>}
 */
export function buildConceptosIVA({
  totalVentasGravadas = 0,
  ivaVentas = 0,
  totalVentasCero = 0,
  totalCompras = 0,
  ivaCompras = 0,
}) {
  // Para compras: base sin IVA = totalCompras / 1.15
  const baseCompras = totalCompras > 0 ? totalCompras / (1 + 0.15) : 0;
  const totalVentasBrutas = totalVentasGravadas + totalVentasCero;

  // Saldo: positivo = a pagar al SRI; negativo = crédito a favor
  const saldo = ivaVentas - ivaCompras;

  const conceptos = {};

  // ── VENTAS ─────────────────────────────────────────────────────────────────
  // Casillero 401 → Concepto 450: Ventas locales brutas gravadas tarifa ≠ 0
  if (totalVentasGravadas > 0) {
    conceptos["450"] = fmt(totalVentasGravadas); // Casillero 401: brutas
    conceptos["460"] = fmt(totalVentasGravadas); // Casillero 411: netas (= brutas sin notas de crédito)
    conceptos["470"] = fmt(ivaVentas);           // Casillero 421: impuesto ventas netas
  }

  // Casillero 403 → Concepto 570: Ventas brutas tarifa 0% sin derecho a crédito tributario
  if (totalVentasCero > 0) {
    conceptos["570"] = fmt(totalVentasCero);     // Casillero 403: ventas brutas 0%
    conceptos["580"] = fmt(totalVentasCero);     // Casillero 413: ventas netas 0%
  }

  // Casillero 409 → Concepto 860: Total ventas y otras operaciones brutas
  if (totalVentasBrutas > 0) {
    conceptos["860"] = fmt(totalVentasBrutas);   // Casillero 409: total ventas brutas
    conceptos["870"] = fmt(totalVentasBrutas);   // Casillero 419: total ventas netas
  }

  // Casillero 429 → Concepto 880: Impuesto total ventas y otras operaciones
  if (ivaVentas > 0) {
    conceptos["880"] = fmt(ivaVentas);           // Casillero 429: impuesto total ventas
  }

  // ── ADQUISICIONES Y PAGOS ──────────────────────────────────────────────────
  // Casillero 500 → Concepto 1270: Adquisiciones brutas gravadas ≠ 0 (con CT)
  // La "base imponible bruta" es la base sin IVA antes de descontar notas de crédito.
  if (baseCompras > 0) {
    conceptos["1270"] = fmt(baseCompras);        // Casillero 500: adquisiciones brutas con CT
    conceptos["1280"] = fmt(baseCompras);        // Casillero 510: adquisiciones netas con CT
    conceptos["1290"] = fmt(ivaCompras);         // Casillero 520: impuesto adquisiciones con CT
    conceptos["1780"] = fmt(baseCompras);        // Casillero 509: total adquisiciones brutas
    conceptos["1790"] = fmt(baseCompras);        // Casillero 519: total adquisiciones netas
    conceptos["1800"] = fmt(ivaCompras);         // Casillero 529: impuesto total adquisiciones
  }

  // ── LIQUIDACIÓN ────────────────────────────────────────────────────────────
  // Casillero 564 → Concepto 2130: Crédito tributario aplicable en este período
  if (ivaCompras > 0) {
    conceptos["2130"] = fmt(ivaCompras);         // Casillero 564: crédito tributario aplicable
  }

  if (saldo > 0) {
    // Debes al SRI
    conceptos["2140"] = fmt(saldo);              // Casillero 601: impuesto causado
    conceptos["2250"] = fmt(saldo);              // Casillero 620: subtotal a pagar
    conceptos["2610"] = fmt(saldo);              // Casillero 902: total impuesto a pagar
  } else if (saldo < 0) {
    // Saldo a favor: no incluir 601; registrar en 602 y arrastrar a 615
    conceptos["2150"] = fmt(Math.abs(saldo));    // Casillero 602: crédito tributario a favor
    conceptos["2220"] = fmt(Math.abs(saldo));    // Casillero 615: saldo CT para próximo período
  }

  return conceptos;
}

/**
 * Genera el contenido XML para subir al portal SRI.
 * Estructura: <detallesDeclaracion><detalle concepto="N">V</detalle>...</detallesDeclaracion>
 */
export function generarXMLIVA(params) {
  const conceptos = buildConceptosIVA(params);
  const lineas = Object.entries(conceptos)
    .map(([c, v]) => `  <detalle concepto="${c}">${v}</detalle>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<detallesDeclaracion>\n${lineas}\n</detallesDeclaracion>`;
}

/**
 * Genera el contenido JSON para subir al portal SRI.
 * Estructura: { "detallesDeclaracion": { "450": "100.00", ... } }
 */
export function generarJSONIVA(params) {
  const conceptos = buildConceptosIVA(params);
  return JSON.stringify({ detallesDeclaracion: conceptos }, null, 2);
}

/**
 * Dispara la descarga del archivo XML.
 * Nombre: IVA_[RUC]_[periodo].xml  (ej: IVA_1712345678001_2024-03.xml)
 *
 * @param {object} params  - Valores IVA (ver buildConceptosIVA)
 * @param {string} ruc     - RUC / cédula del contribuyente
 * @param {string} periodo - "2024-03" (mensual) o "2024-S1" (semestral)
 */
export function descargarXMLIVA(params, ruc, periodo) {
  const contenido = generarXMLIVA(params);
  const blob = new Blob([contenido], { type: "application/xml;charset=UTF-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `IVA_${ruc || "SRI"}_${periodo}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Dispara la descarga del archivo JSON.
 * Nombre: IVA_[RUC]_[periodo].json
 */
export function descargarJSONIVA(params, ruc, periodo) {
  const contenido = generarJSONIVA(params);
  const blob = new Blob([contenido], { type: "application/json;charset=UTF-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `IVA_${ruc || "SRI"}_${periodo}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
