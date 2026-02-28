/**
 * Generador de archivo XML para importar al software DIMM Formularios del SRI.
 * Formulario 102 — Declaración de Impuesto a la Renta Personas Naturales.
 *
 * El DIMM acepta XML con la estructura de casillas del Form. 102.
 * Los valores se exportan con 2 decimales.
 */

function fmt2(n) {
  return parseFloat(n || 0).toFixed(2);
}

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
 * Dispara la descarga del archivo XML.
 */
export function descargarArchivoIR(declaracion, perfil, tipoContribuyente) {
  const xml = generarArchivoIR(declaracion, perfil, tipoContribuyente);
  const blob = new Blob([xml], { type: "application/xml;charset=UTF-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `IR_${perfil?.cedula || "SRI"}_${declaracion.anio_fiscal}.xml`;
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
