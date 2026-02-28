/**
 * Tablas de Impuesto a la Renta 2025 — Ecuador
 * Fuente: SRI Ecuador (verificar valores en sri.gob.ec antes de producción)
 */

// Tabla progresiva personas naturales 2025
const TABLA_IR_2025 = [
  { desde: 0,      hasta: 11902,    base: 0,         porcentaje: 0 },
  { desde: 11902,  hasta: 15159,    base: 0,         porcentaje: 0.05 },
  { desde: 15159,  hasta: 19682,    base: 162.85,    porcentaje: 0.10 },
  { desde: 19682,  hasta: 26031,    base: 615.15,    porcentaje: 0.12 },
  { desde: 26031,  hasta: 34255,    base: 1376.83,   porcentaje: 0.15 },
  { desde: 34255,  hasta: 45407,    base: 2610.43,   porcentaje: 0.20 },
  { desde: 45407,  hasta: 60450,    base: 4840.83,   porcentaje: 0.25 },
  { desde: 60450,  hasta: 80605,    base: 8601.58,   porcentaje: 0.30 },
  { desde: 80605,  hasta: Infinity, base: 14648.08,  porcentaje: 0.35 },
];

// ⚠️ Verificar valores exactos 2025 en sri.gob.ec/rimpe
const TABLA_RIMPE_EMPRENDEDOR_2025 = [
  { desde: 0,       hasta: 5000,    base: 0,    porcentaje: 0 },
  { desde: 5000,    hasta: 10000,   base: 0,    porcentaje: 0.0002 },
  { desde: 10000,   hasta: 20000,   base: 1,    porcentaje: 0.0003 },
  { desde: 20000,   hasta: 30000,   base: 4,    porcentaje: 0.0004 },
  { desde: 30000,   hasta: 50000,   base: 8,    porcentaje: 0.0005 },
  { desde: 50000,   hasta: 100000,  base: 18,   porcentaje: 0.0006 },
  { desde: 100000,  hasta: 150000,  base: 48,   porcentaje: 0.0008 },
  { desde: 150000,  hasta: 300000,  base: 88,   porcentaje: 0.0009 },
  { desde: 300000,  hasta: Infinity, base: 223, porcentaje: 0.001 },
];

// Cuota fija anual para RIMPE Negocio Popular (ingresos máx $20,000/año)
// ⚠️ Verificar valores exactos 2025 en sri.gob.ec/rimpe
const TABLA_RIMPE_NEGOCIO_POPULAR_2025 = [
  { desde: 0,     hasta: 5000,    cuota: 60 },
  { desde: 5000,  hasta: 10000,   cuota: 120 },
  { desde: 10000, hasta: 15000,   cuota: 180 },
  { desde: 15000, hasta: 20000,   cuota: 240 },
  { desde: 20000, hasta: Infinity, cuota: 300 },
];

function calcProgresivo(base, tabla) {
  if (base <= 0) return 0;
  for (let i = tabla.length - 1; i >= 0; i--) {
    const tramo = tabla[i];
    if (base > tramo.desde) {
      return tramo.base + (base - tramo.desde) * tramo.porcentaje;
    }
  }
  return 0;
}

function calcRimpeEmprendedor(ingresos) {
  if (ingresos <= 0) return 0;
  for (let i = TABLA_RIMPE_EMPRENDEDOR_2025.length - 1; i >= 0; i--) {
    const tramo = TABLA_RIMPE_EMPRENDEDOR_2025[i];
    if (ingresos > tramo.desde) {
      return tramo.base + (ingresos - tramo.desde) * tramo.porcentaje;
    }
  }
  return 0;
}

function calcRimpeNegocioPopular(ingresos) {
  if (ingresos <= 0) return 0;
  for (let i = TABLA_RIMPE_NEGOCIO_POPULAR_2025.length - 1; i >= 0; i--) {
    const tramo = TABLA_RIMPE_NEGOCIO_POPULAR_2025[i];
    if (ingresos > tramo.desde) return tramo.cuota;
  }
  return 60;
}

/**
 * Calcula el IR estimado según tipo de contribuyente.
 *
 * Convención de ingresos:
 * - dependencia_pura / dependencia_con_extras: ingresos = salario neto anual (ya descontado IESS)
 *   → base_imponible = ingresos - gastosDeducibles
 * - freelancer_general / arrendador_general: ingresos = ventas + otros_ingresos
 *   → base_imponible = ingresos - gastosDeducibles
 * - rimpe_emprendedor: tabla RIMPE sobre ingresos brutos (sin deducir GP)
 * - rimpe_negocio_popular: cuota fija por rango de ingresos
 *
 * @param {number} ingresos - Ingresos anuales (ver convención arriba)
 * @param {number} gastosDeducibles - Gastos personales AGP + gastos negocio
 * @param {string} tipoContribuyente - Clave del tipo de contribuyente
 * @returns {number} IR estimado en USD
 */
export function calcularIR(ingresos, gastosDeducibles, tipoContribuyente) {
  if (!ingresos || ingresos <= 0) return 0;

  if (tipoContribuyente === "rimpe_emprendedor") {
    return Math.round(calcRimpeEmprendedor(ingresos) * 100) / 100;
  }

  if (tipoContribuyente === "rimpe_negocio_popular") {
    return calcRimpeNegocioPopular(ingresos);
  }

  // General progressive table (dependencia_pura, dependencia_con_extras,
  // freelancer_general, arrendador_general)
  const base = Math.max(0, ingresos - (gastosDeducibles || 0));
  return Math.round(calcProgresivo(base, TABLA_IR_2025) * 100) / 100;
}

/**
 * Devuelve la tasa marginal (porcentaje) para un nivel de ingresos dado.
 * Útil para mostrar "en este tramo pagas X% sobre cada dólar extra".
 */
export function tasaMarginalIR(base) {
  if (base <= 0) return 0;
  for (let i = TABLA_IR_2025.length - 1; i >= 0; i--) {
    if (base > TABLA_IR_2025[i].desde) return TABLA_IR_2025[i].porcentaje;
  }
  return 0;
}

export { TABLA_IR_2025, TABLA_RIMPE_EMPRENDEDOR_2025, TABLA_RIMPE_NEGOCIO_POPULAR_2025 };
