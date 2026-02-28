// Mora calculation per SRI Ecuador normativa
// Art. 100 LRTI (multas) + Art. 21 Código Tributario (intereses)
// Tasas BCE Q1 2025

export const CONFIG_SRI_DEFAULTS = {
  tasa_mora_voluntaria_mensual: 0.869,       // % mensual, tasa activa referencial BCE 90d
  tasa_mora_notificado_mensual: 1.130,       // % mensual, 1.3x la anterior
  trimestre_vigente: "Q1-2025",
  multa_iva_voluntaria_con_ventas_pn: 0.001, // 0.1% de ventas × meses o fracción
  multa_iva_voluntaria_sin_ventas_pn: 30.00, // $30 fijo si no hay ventas (persona natural)
  multa_ir_con_impuesto_porcentaje: 0.03,    // 3% del IR causado × meses (máx 100% impuesto)
  multa_ir_sin_impuesto_porcentaje: 0.001,   // 0.1% de ingresos brutos × meses (máx 5%)
  multa_agp_no_obligado_contabilidad: 30.00, // $30 fijo
  multa_agp_obligado_contabilidad: 45.00,    // $45 fijo
};

/**
 * Calcula multas e intereses por mora según normativa SRI Ecuador.
 *
 * @param {Object} p
 * @param {string} p.tipoObligacion  'iva_mensual'|'iva_semestral'|'ir_anual'|'ir_anual_rimpe'|'agp'
 * @param {Date}   p.fechaVencimiento
 * @param {Date}   [p.fechaCalculo]   default: hoy
 * @param {number} [p.impuestoCausado] valor a pagar (0 si no hay o se desconoce)
 * @param {number} [p.ventasPeriodo]  total ventas del período (para IVA)
 * @param {number} [p.ingresosBrutos] ingresos brutos anuales (para IR sin impuesto)
 * @param {boolean}[p.notificadoPorSRI] default false (voluntaria = tasa menor)
 * @param {Object} [p.config]         valores de configuracion_sri
 *
 * @returns {{ diasMora, mesesMora, multa, intereses, totalMora, totalAPagar,
 *             detalleMulta, detalleInteres, notificadoPorSRI, desconocido }}
 */
export function calcularMora({
  tipoObligacion,
  fechaVencimiento,
  fechaCalculo = new Date(),
  impuestoCausado = 0,
  ventasPeriodo = 0,
  ingresosBrutos = 0,
  notificadoPorSRI = false,
  config = CONFIG_SRI_DEFAULTS,
}) {
  const cero = {
    diasMora: 0, mesesMora: 0, multa: 0, intereses: 0,
    totalMora: 0, totalAPagar: impuestoCausado,
    detalleMulta: "", detalleInteres: "", notificadoPorSRI, desconocido: false,
  };

  const diasMora = Math.floor((fechaCalculo - fechaVencimiento) / (1000 * 60 * 60 * 24));
  if (diasMora <= 0) return cero;

  const mesesMora = Math.ceil(diasMora / 30);

  // ── Multa ─────────────────────────────────────────────────────────────────
  let multa = 0;
  let detalleMulta = "";
  let desconocido = false;

  const esIva = tipoObligacion === "iva_mensual" || tipoObligacion === "iva_semestral";
  const esIr  = tipoObligacion === "ir_anual" || tipoObligacion === "ir_anual_rimpe";

  if (esIva) {
    if (ventasPeriodo > 0) {
      multa = ventasPeriodo * config.multa_iva_voluntaria_con_ventas_pn * mesesMora;
      detalleMulta = `0.1% de ventas del período × ${mesesMora} mes(es)`;
    } else {
      multa = config.multa_iva_voluntaria_sin_ventas_pn;
      detalleMulta = "Multa fija por declaración sin ventas";
    }
  } else if (esIr) {
    if (impuestoCausado > 0) {
      const raw = impuestoCausado * config.multa_ir_con_impuesto_porcentaje * mesesMora;
      multa = Math.min(raw, impuestoCausado); // tope: 100% del impuesto
      detalleMulta = `3% del IR causado × ${mesesMora} mes(es)` +
        (raw >= impuestoCausado ? " (tope 100%)" : "");
    } else if (ingresosBrutos > 0) {
      const raw = ingresosBrutos * config.multa_ir_sin_impuesto_porcentaje * mesesMora;
      multa = Math.min(raw, ingresosBrutos * 0.05); // tope: 5% de ingresos
      detalleMulta = `0.1% de ingresos brutos × ${mesesMora} mes(es)`;
    } else {
      // No hay datos suficientes para calcular
      desconocido = true;
      detalleMulta = "pendiente";
    }
  } else if (tipoObligacion === "agp") {
    multa = config.multa_agp_no_obligado_contabilidad;
    detalleMulta = "Multa fija por presentación tardía";
  }

  // ── Intereses (solo si hay impuesto a pagar) ──────────────────────────────
  let intereses = 0;
  let detalleInteres = "";
  if (impuestoCausado > 0) {
    const tasa = (notificadoPorSRI
      ? config.tasa_mora_notificado_mensual
      : config.tasa_mora_voluntaria_mensual) / 100;
    intereses = impuestoCausado * tasa * mesesMora;
    const pct = notificadoPorSRI
      ? config.tasa_mora_notificado_mensual
      : config.tasa_mora_voluntaria_mensual;
    detalleInteres = `${pct}% mensual × ${mesesMora} mes(es)`;
  }

  const totalMora = multa + intereses;
  const totalAPagar = impuestoCausado + totalMora;

  return {
    diasMora,
    mesesMora,
    multa:       Math.round(multa * 100) / 100,
    intereses:   Math.round(intereses * 100) / 100,
    totalMora:   Math.round(totalMora * 100) / 100,
    totalAPagar: Math.round(totalAPagar * 100) / 100,
    detalleMulta,
    detalleInteres,
    notificadoPorSRI,
    desconocido,
  };
}

/**
 * Fecha en que la multa subirá al siguiente escalón (próximo mes de mora).
 */
export function proximoAumentoMora(diasMora) {
  const mesesCumplidos = Math.ceil(diasMora / 30);
  const diasHastaProximo = mesesCumplidos * 30 - diasMora;
  const d = new Date();
  d.setDate(d.getDate() + diasHastaProximo);
  return d;
}
