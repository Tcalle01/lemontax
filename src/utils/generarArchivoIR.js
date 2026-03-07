/**
 * Generador de archivos para la Declaración de Impuesto a la Renta.
 * Formulario 102 — Personas Naturales.
 *
 * Incluye dos formatos:
 *   1. Portal SRI en línea — XML/JSON con concepto codes (buildConceptosIR, generarXMLIR, generarJSONIR)
 *   2. DIMM Formularios — XML legacy para software de escritorio (generarArchivoIR)
 *
 * Tabla Casillero → Concepto basada en la guía SRI Form 102 (portal en línea).
 * Solo se incluyen conceptos con valor > 0.
 */

function fmt2(n) {
  return parseFloat(n || 0).toFixed(2);
}

// ─── Portal SRI en línea ────────────────────────────────────────────────────

/**
 * Construye el mapa concepto → valor para el formulario 102 (portal SRI).
 * Devuelve solo los conceptos con valor > 0.
 *
 * Mapeo Casillero → Concepto (Form 102 portal SRI):
 *   Ingresos dependencia    → 3240 (C301 / C741)
 *   Ingresos libre ejercicio → 2990 (C612) — freelancer / arrendador
 *   Ingresos empresariales  → 1280 (C611) — dependencia_con_extras / negocio
 *   Otros ingresos          → 3022 (C303)
 *   Gastos libre ejercicio  → 3000 (C632)
 *   Gastos empresariales    → 1290 (C631)
 *   GP salud                → 3290 (C774 / C451)
 *   GP educación            → 5040 (C773 / C452)
 *   GP alimentación         → 3300 (C775 / C453)
 *   GP vivienda             → 3310 (C776 / C454)
 *   GP vestimenta           → 3320 (C777 / C455)
 *   Total GP                → 3330 (C797 / C499)
 *   Base imponible          → 3480 (C832 / C839)
 *   IR causado régimen gral → 3490 (C849)
 *   IR causado RIMPE emp.   → 5680 + 3505 (C864 / C827)
 *   IR cuota RIMPE neg pop  → 5688 (C867)
 *   Retenciones fuente      → 3510 (C845 / C879)
 *   Retenciones dependencia → 3515 (C846)
 *   Anticipos pagados       → 3530 (C882)
 *   Ingresos RIMPE          → 4825 (C765)
 *   Gastos RIMPE            → 4826 (C766)
 *   Subtotal a pagar        → 3562 (C855)
 *   IR a pagar              → 3570 (C868)
 *   Subtotal saldo a favor  → 3564 (C856)
 *   Saldo a favor           → 3590 (C869)
 */
export function buildConceptosIR({
  ingresos_dependencia = 0,
  ingresos_facturacion = 0,
  ingresos_otros = 0,
  gastos_deducibles_negocio = 0,
  gastos_personales_salud = 0,
  gastos_personales_educacion = 0,
  gastos_personales_alimentacion = 0,
  gastos_personales_vivienda = 0,
  gastos_personales_vestimenta = 0,
  base_imponible = 0,
  ir_causado = 0,
  retenciones_recibidas = 0,
  anticipos_pagados = 0,
  ir_a_pagar = 0,
  tipoContribuyente = "dependencia_pura",
}) {
  const esRimpe = ["rimpe_emprendedor", "rimpe_negocio_popular"].includes(tipoContribuyente);
  const esNegocioPopular = tipoContribuyente === "rimpe_negocio_popular";
  const esDependencia = ["dependencia_pura", "dependencia_con_extras"].includes(tipoContribuyente);
  const esLibreEjercicio = ["freelancer_general", "arrendador_general"].includes(tipoContribuyente);

  const dep = parseFloat(ingresos_dependencia);
  const fact = parseFloat(ingresos_facturacion);
  const otros = parseFloat(ingresos_otros);
  const gastosNeg = parseFloat(gastos_deducibles_negocio);
  const gpSalud = parseFloat(gastos_personales_salud);
  const gpEdu = parseFloat(gastos_personales_educacion);
  const gpAlim = parseFloat(gastos_personales_alimentacion);
  const gpViv = parseFloat(gastos_personales_vivienda);
  const gpVest = parseFloat(gastos_personales_vestimenta);
  const totalGP = gpSalud + gpEdu + gpAlim + gpViv + gpVest;
  const base = parseFloat(base_imponible);
  const irCaus = parseFloat(ir_causado);
  const ret = parseFloat(retenciones_recibidas);
  const ant = parseFloat(anticipos_pagados);
  const irFinal = parseFloat(ir_a_pagar);

  const conceptos = {};

  if (esRimpe) {
    // ── RIMPE ──────────────────────────────────────────────────────────────
    // Ingresos y gastos RIMPE
    if (fact > 0 || otros > 0) {
      conceptos["4825"] = fmt2(fact + otros); // C765: ingresos gravados RIMPE
    }
    if (gastosNeg > 0) {
      conceptos["4826"] = fmt2(gastosNeg);    // C766: gastos atribuibles RIMPE
    }
    if (base > 0) {
      conceptos["3480"] = fmt2(base);          // C832: base imponible
    }
    if (irCaus > 0) {
      if (esNegocioPopular) {
        conceptos["5688"] = fmt2(irCaus);      // C867: cuota RIMPE negocio popular
      } else {
        conceptos["5680"] = fmt2(irCaus);      // C864: IR RIMPE emprendedor
        conceptos["3505"] = fmt2(irCaus);      // C827: impuesto causado RIMPE
      }
    }
  } else {
    // ── RÉGIMEN GENERAL ────────────────────────────────────────────────────

    // INGRESOS
    if (dep > 0) {
      conceptos["3240"] = fmt2(dep);           // C741: sueldos relación dependencia
    }
    if (fact > 0) {
      if (esLibreEjercicio) {
        conceptos["2990"] = fmt2(fact);        // C612: libre ejercicio profesional / arriendo
      } else {
        conceptos["1280"] = fmt2(fact);        // C611: actividades empresariales
      }
    }
    if (otros > 0) {
      conceptos["3022"] = fmt2(otros);         // C303: otros ingresos
    }

    // GASTOS DEDUCIBLES ACTIVIDAD
    if (gastosNeg > 0) {
      if (esLibreEjercicio) {
        conceptos["3000"] = fmt2(gastosNeg);   // C632: gastos libre ejercicio
      } else {
        conceptos["1290"] = fmt2(gastosNeg);   // C631: gastos actividad empresarial
      }
    }

    // GASTOS PERSONALES
    if (gpSalud > 0) conceptos["3290"] = fmt2(gpSalud);     // C774: salud
    if (gpEdu > 0)   conceptos["5040"] = fmt2(gpEdu);       // C773: educación
    if (gpAlim > 0)  conceptos["3300"] = fmt2(gpAlim);      // C775: alimentación
    if (gpViv > 0)   conceptos["3310"] = fmt2(gpViv);       // C776: vivienda
    if (gpVest > 0)  conceptos["3320"] = fmt2(gpVest);      // C777: vestimenta
    if (totalGP > 0) conceptos["3330"] = fmt2(totalGP);     // C797: total gastos personales

    // BASE E IMPUESTO
    if (base > 0) {
      conceptos["3480"] = fmt2(base);          // C832: base imponible gravada
    }
    if (irCaus > 0) {
      conceptos["3490"] = fmt2(irCaus);        // C849: IR causado régimen general
    }
  }

  // ── RETENCIONES Y ANTICIPOS (todos los regímenes) ──────────────────────
  if (ret > 0) {
    if (esDependencia && !esLibreEjercicio) {
      conceptos["3515"] = fmt2(ret);           // C846: retenciones en dependencia
    } else {
      conceptos["3510"] = fmt2(ret);           // C845: retenciones en la fuente
    }
  }
  if (ant > 0) {
    conceptos["3530"] = fmt2(ant);             // C882: anticipos pagados
  }

  // ── RESULTADO FINAL (mutuamente excluyentes) ───────────────────────────
  if (irFinal > 0) {
    conceptos["3562"] = fmt2(irFinal);         // C855: subtotal impuesto a pagar
    conceptos["3570"] = fmt2(irFinal);         // C868: impuesto a la renta a pagar
  } else if (irFinal < 0) {
    const favor = Math.abs(irFinal);
    conceptos["3564"] = fmt2(favor);           // C856: subtotal saldo a favor
    conceptos["3590"] = fmt2(favor);           // C869: saldo a favor del contribuyente
  }

  return conceptos;
}

/**
 * Genera el contenido XML para subir al portal SRI.
 * Estructura: <detallesDeclaracion><detalle concepto="N">V</detalle>...</detallesDeclaracion>
 */
export function generarXMLIR(params) {
  const conceptos = buildConceptosIR(params);
  const lineas = Object.entries(conceptos)
    .map(([c, v]) => `  <detalle concepto="${c}">${v}</detalle>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<detallesDeclaracion>\n${lineas}\n</detallesDeclaracion>`;
}

/**
 * Genera el contenido JSON para subir al portal SRI.
 * Estructura: { "detallesDeclaracion": { "3240": "12000.00", ... } }
 */
export function generarJSONIR(params) {
  const conceptos = buildConceptosIR(params);
  return JSON.stringify({ detallesDeclaracion: conceptos }, null, 2);
}

/**
 * Dispara la descarga del archivo XML para portal SRI.
 * Nombre: IR_[RUC]_[anio].xml
 */
export function descargarXMLIR(params, ruc, anio) {
  const contenido = generarXMLIR(params);
  const blob = new Blob([contenido], { type: "application/xml;charset=UTF-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `IR_${ruc || "SRI"}_${anio}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Dispara la descarga del archivo JSON para portal SRI.
 * Nombre: IR_[RUC]_[anio].json
 */
export function descargarJSONIR(params, ruc, anio) {
  const contenido = generarJSONIR(params);
  const blob = new Blob([contenido], { type: "application/json;charset=UTF-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `IR_${ruc || "SRI"}_${anio}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── DIMM Formularios (formato legacy para software de escritorio) ──────────

/**
 * Genera el contenido XML del archivo IR para importar al DIMM.
 *
 * @param {object} declaracion - Campos de declaraciones_ir
 * @param {object} perfil - Perfil del usuario (cedula, nombre)
 * @param {string} tipoContribuyente - Para marcar régimen
 * @returns {string} Contenido XML
 */
export function generarArchivoIR(declaracion, perfil, tipoContribuyente = "dependencia_pura") {
  const {
    anio_fiscal,
    ingresos_dependencia = 0,
    ingresos_facturacion = 0,
    ingresos_otros = 0,
    gastos_deducibles_negocio = 0,
    gastos_personales_salud = 0,
    gastos_personales_educacion = 0,
    gastos_personales_alimentacion = 0,
    gastos_personales_vivienda = 0,
    gastos_personales_vestimenta = 0,
    base_imponible = 0,
    ir_causado = 0,
    retenciones_recibidas = 0,
    anticipos_pagados = 0,
    ir_a_pagar = 0,
  } = declaracion;

  const totalIngresos = parseFloat(ingresos_dependencia) + parseFloat(ingresos_facturacion) + parseFloat(ingresos_otros);
  const totalDeducciones =
    parseFloat(gastos_deducibles_negocio) +
    parseFloat(gastos_personales_salud) +
    parseFloat(gastos_personales_educacion) +
    parseFloat(gastos_personales_alimentacion) +
    parseFloat(gastos_personales_vivienda) +
    parseFloat(gastos_personales_vestimenta);

  const esRimpe = ["rimpe_emprendedor", "rimpe_negocio_popular"].includes(tipoContribuyente);
  const regimen = esRimpe ? `RIMPE_${tipoContribuyente === "rimpe_emprendedor" ? "EMPRENDEDOR" : "NEGOCIO_POPULAR"}` : "GENERAL";
  const fechaGeneracion = new Date().toISOString().split("T")[0];

  return `<?xml version="1.0" encoding="UTF-8"?>
<formulario102>
  <cabecera>
    <ruc>${escapeXml(perfil?.cedula || "")}</ruc>
    <razonSocial>${escapeXml(perfil?.nombre || "")}</razonSocial>
    <anioFiscal>${anio_fiscal}</anioFiscal>
    <tipoContribuyente>PN</tipoContribuyente>
    <regimen>${regimen}</regimen>
    <fechaGeneracion>${fechaGeneracion}</fechaGeneracion>
  </cabecera>
  <ingresos>
    <casilla301>${fmt2(ingresos_dependencia)}</casilla301>
    <casilla302>${fmt2(ingresos_facturacion)}</casilla302>
    <casilla303>${fmt2(ingresos_otros)}</casilla303>
    <casilla399>${fmt2(totalIngresos)}</casilla399>
  </ingresos>
  <deducciones>
    <casilla401>${fmt2(gastos_deducibles_negocio)}</casilla401>
    <casilla451>${fmt2(gastos_personales_salud)}</casilla451>
    <casilla452>${fmt2(gastos_personales_educacion)}</casilla452>
    <casilla453>${fmt2(gastos_personales_alimentacion)}</casilla453>
    <casilla454>${fmt2(gastos_personales_vivienda)}</casilla454>
    <casilla455>${fmt2(gastos_personales_vestimenta)}</casilla455>
    <casilla499>${fmt2(totalDeducciones)}</casilla499>
  </deducciones>
  <liquidacion>
    <casilla839>${fmt2(base_imponible)}</casilla839>
    <casilla849>${fmt2(ir_causado)}</casilla849>
    <casilla879>${fmt2(retenciones_recibidas)}</casilla879>
    <casilla882>${fmt2(anticipos_pagados)}</casilla882>
    <casilla899>${fmt2(ir_a_pagar)}</casilla899>
  </liquidacion>
</formulario102>`;
}

/**
 * Dispara la descarga del archivo XML para DIMM.
 */
export function descargarArchivoIR(declaracion, perfil, tipoContribuyente) {
  const xml = generarArchivoIR(declaracion, perfil, tipoContribuyente);
  const blob = new Blob([xml], { type: "application/xml;charset=UTF-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `IR_DIMM_${perfil?.cedula || "SRI"}_${declaracion.anio_fiscal}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
