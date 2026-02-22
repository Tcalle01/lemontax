import * as XLSX from "xlsx";

// ─── Colores SRI ──────────────────────────────────────────────────────────────
const VERDE = "1A3A2A";
const AMARILLO = "F5E642";
const BLANCO = "FFFFFF";
const GRIS = "F2F2F2";
const VERDE_CLARO = "E8F5E9";
const NEGRO = "000000";

function cellStyle(opts = {}) {
  return {
    font: {
      name: "Arial",
      sz: opts.sz || 10,
      bold: opts.bold || false,
      color: { rgb: opts.fontColor || NEGRO },
    },
    fill: opts.bg ? { fgColor: { rgb: opts.bg }, patternType: "solid" } : undefined,
    alignment: {
      horizontal: opts.align || "left",
      vertical: "center",
      wrapText: opts.wrap || false,
    },
    border: {
      top: { style: "thin", color: { rgb: "CCCCCC" } },
      bottom: { style: "thin", color: { rgb: "CCCCCC" } },
      left: { style: "thin", color: { rgb: "CCCCCC" } },
      right: { style: "thin", color: { rgb: "CCCCCC" } },
    },
  };
}

function setCell(ws, ref, value, style) {
  ws[ref] = { v: value, t: typeof value === "number" ? "n" : "s", s: style };
}

function fmt(n) {
  return parseFloat(n || 0).toFixed(2);
}

// ─── FORMULARIO GP ────────────────────────────────────────────────────────────
export function generarFormularioGP({ perfil, facturas, rebaja, salarioAnual, cargas, canasta = 821.80 }) {
  const wb = XLSX.utils.book_new();
  const ws = {};

  const catTotals = {};
  facturas.filter(f => f.sri).forEach(f => {
    catTotals[f.categoria] = (catTotals[f.categoria] || 0) + f.monto;
  });

  const totalGastos =
    (catTotals["Vivienda"] || 0) +
    (catTotals["Educación"] || 0) +
    (catTotals["Salud"] || 0) +
    (catTotals["Vestimenta"] || 0) +
    (catTotals["Alimentación"] || 0) +
    (catTotals["Turismo"] || 0);

  const otrosAnual = parseFloat(perfil.otrosIngresos || 0) * 12;
  const totalIngresos = salarioAnual + otrosAnual;

  // ── Título principal ──
  ws["A1"] = { v: "DECLARACIÓN DE GASTOS PERSONALES A SER UTILIZADOS POR EL EMPLEADOR EN EL CASO DE INGRESOS EN RELACIÓN DE DEPENDENCIA", t: "s", s: cellStyle({ bold: true, sz: 11, fontColor: BLANCO, bg: VERDE, align: "center", wrap: true }) };
  ws["A2"] = { v: "FORMULARIO SRI-GP", t: "s", s: cellStyle({ bold: true, sz: 12, fontColor: AMARILLO, bg: VERDE, align: "center" }) };
  ws["A3"] = { v: `EJERCICIO FISCAL: ${new Date().getFullYear()}`, t: "s", s: cellStyle({ bold: true, sz: 10, fontColor: BLANCO, bg: VERDE }) };

  // Merge title rows
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
  ];

  // ── Identificación del empleado ──
  ws["A5"] = { v: "Información / Identificación del empleado contribuyente", t: "s", s: cellStyle({ bold: true, sz: 10, fontColor: BLANCO, bg: VERDE_CLARO.replace("E8F5E9", "2D5A3D") }) };
  ws["!merges"].push({ s: { r: 4, c: 0 }, e: { r: 4, c: 5 } });

  ws["A6"] = { v: "101", t: "s", s: cellStyle({ bold: true, bg: GRIS }) };
  ws["B6"] = { v: "CÉDULA O PASAPORTE", t: "s", s: cellStyle({ bold: true, bg: GRIS }) };
  ws["C6"] = { v: perfil.cedula || "", t: "s", s: cellStyle({ bold: true }) };
  ws["D6"] = { v: "102", t: "s", s: cellStyle({ bold: true, bg: GRIS }) };
  ws["E6"] = { v: "APELLIDOS Y NOMBRES COMPLETOS", t: "s", s: cellStyle({ bold: true, bg: GRIS }) };
  ws["F6"] = { v: perfil.nombre || "", t: "s", s: cellStyle({ bold: true }) };

  // ── Ingresos proyectados ──
  ws["A8"] = { v: "INGRESOS PROYECTADOS", t: "s", s: cellStyle({ bold: true, sz: 10, fontColor: BLANCO, bg: VERDE }) };
  ws["!merges"].push({ s: { r: 7, c: 0 }, e: { r: 7, c: 5 } });

  const ingresosRows = [
    ["103", "(+) TOTAL INGRESOS CON ESTE EMPLEADOR", salarioAnual],
    ["104", "(+) TOTAL INGRESOS CON OTROS EMPLEADORES", otrosAnual],
    ["105", "(=) TOTAL INGRESOS PROYECTADOS", totalIngresos],
  ];

  ingresosRows.forEach(([cod, label, val], i) => {
    const row = 9 + i;
    const isTotal = cod === "105";
    ws[`A${row}`] = { v: cod, t: "s", s: cellStyle({ bold: true, bg: isTotal ? GRIS : BLANCO, align: "center" }) };
    ws[`B${row}`] = { v: label, t: "s", s: cellStyle({ bold: isTotal, bg: isTotal ? GRIS : BLANCO }) };
    ws["!merges"].push({ s: { r: row - 1, c: 1 }, e: { r: row - 1, c: 4 } });
    ws[`F${row}`] = { v: parseFloat(fmt(val)), t: "n", s: cellStyle({ bold: isTotal, align: "right", bg: isTotal ? AMARILLO : BLANCO, fontColor: isTotal ? NEGRO : NEGRO }) };
  });

  // ── Gastos proyectados ──
  ws["A13"] = { v: "GASTOS PROYECTADOS", t: "s", s: cellStyle({ bold: true, sz: 10, fontColor: BLANCO, bg: VERDE }) };
  ws["!merges"].push({ s: { r: 12, c: 0 }, e: { r: 12, c: 5 } });

  const gastosRows = [
    ["106", "(+) GASTOS DE VIVIENDA", (catTotals["Vivienda"] || 0) * 12],
    ["107", "(+) GASTOS DE EDUCACIÓN, ARTE Y CULTURA", (catTotals["Educación"] || 0) * 12],
    ["108", "(+) GASTOS DE SALUD", (catTotals["Salud"] || 0) * 12],
    ["109", "(+) GASTOS DE VESTIMENTA", (catTotals["Vestimenta"] || 0) * 12],
    ["110", "(+) GASTOS DE ALIMENTACIÓN", (catTotals["Alimentación"] || 0) * 12],
    ["111", "(+) GASTOS DE TURISMO", (catTotals["Turismo"] || 0) * 12],
    ["112", "(=) TOTAL GASTOS PROYECTADOS (106+107+108+109+110+111)", totalGastos * 12],
  ];

  gastosRows.forEach(([cod, label, val], i) => {
    const row = 14 + i;
    const isTotal = cod === "112";
    ws[`A${row}`] = { v: cod, t: "s", s: cellStyle({ bold: true, bg: isTotal ? VERDE : GRIS, fontColor: isTotal ? AMARILLO : NEGRO, align: "center" }) };
    ws[`B${row}`] = { v: label, t: "s", s: cellStyle({ bold: isTotal, bg: isTotal ? VERDE : BLANCO, fontColor: isTotal ? BLANCO : NEGRO }) };
    ws["!merges"].push({ s: { r: row - 1, c: 1 }, e: { r: row - 1, c: 4 } });
    ws[`F${row}`] = { v: parseFloat(fmt(val)), t: "n", s: cellStyle({ bold: true, align: "right", bg: isTotal ? AMARILLO : BLANCO }) };
  });

  // ── Rebaja y cargas ──
  ws["A22"] = { v: "TRABAJADOR CON DISCAPACIDAD / ENFERMEDAD CATASTRÓFICA", t: "s", s: cellStyle({ bold: true, bg: GRIS }) };
  ws["!merges"].push({ s: { r: 21, c: 0 }, e: { r: 21, c: 4 } });
  ws["A22"] = { v: "113", t: "s", s: cellStyle({ bold: true, bg: GRIS, align: "center" }) };
  ws["B22"] = { v: "TRABAJADOR O CARGAS CON DISCAPACIDAD / ENF. CATASTRÓFICA", t: "s", s: cellStyle({ bg: GRIS }) };
  ws["!merges"].push({ s: { r: 21, c: 1 }, e: { r: 21, c: 4 } });
  ws["F22"] = { v: perfil.enfermedadCatastrofica ? "SÍ" : "NO", t: "s", s: cellStyle({ bold: true, align: "center" }) };

  ws["A23"] = { v: "114", t: "s", s: cellStyle({ bold: true, align: "center" }) };
  ws["B23"] = { v: "NÚMERO DE CARGAS FAMILIARES PARA REBAJA DE GASTOS PERSONALES", t: "s", s: cellStyle({}) };
  ws["!merges"].push({ s: { r: 22, c: 1 }, e: { r: 22, c: 4 } });
  ws["F23"] = { v: parseInt(perfil.cargas || 0), t: "n", s: cellStyle({ bold: true, align: "center" }) };

  ws["A24"] = { v: "115", t: "s", s: cellStyle({ bold: true, bg: AMARILLO, align: "center" }) };
  ws["B24"] = { v: "REBAJA DE IMPUESTO A LA RENTA POR GASTOS PERSONALES PROYECTADOS", t: "s", s: cellStyle({ bold: true, bg: AMARILLO }) };
  ws["!merges"].push({ s: { r: 23, c: 1 }, e: { r: 23, c: 4 } });
  ws["F24"] = { v: parseFloat(fmt(rebaja)), t: "n", s: cellStyle({ bold: true, align: "right", bg: AMARILLO }) };

  // ── Canasta familiar ──
  ws["A26"] = { v: `VALOR CANASTA FAMILIAR BÁSICA (Enero ${new Date().getFullYear()}): $${canasta.toFixed(2)}`, t: "s", s: cellStyle({ sz: 9, fontColor: "666666" }) };
  ws["!merges"].push({ s: { r: 25, c: 0 }, e: { r: 25, c: 5 } });

  // ── Firmas ──
  ws["A28"] = { v: "EMPLEADOR / AGENTE DE RETENCIÓN", t: "s", s: cellStyle({ bold: true, align: "center", bg: GRIS }) };
  ws["!merges"].push({ s: { r: 27, c: 0 }, e: { r: 27, c: 2 } });
  ws["D28"] = { v: "EMPLEADO CONTRIBUYENTE", t: "s", s: cellStyle({ bold: true, align: "center", bg: GRIS }) };
  ws["!merges"].push({ s: { r: 27, c: 3 }, e: { r: 27, c: 5 } });
  ws["A31"] = { v: "Firma y sello", t: "s", s: cellStyle({ align: "center", fontColor: "999999" }) };
  ws["!merges"].push({ s: { r: 30, c: 0 }, e: { r: 30, c: 2 } });
  ws["D31"] = { v: "Firma", t: "s", s: cellStyle({ align: "center", fontColor: "999999" }) };
  ws["!merges"].push({ s: { r: 30, c: 3 }, e: { r: 30, c: 5 } });

  // Column widths
  ws["!cols"] = [
    { wch: 8 }, { wch: 50 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
  ];

  // Row heights
  ws["!rows"] = [
    { hpt: 40 }, { hpt: 24 }, { hpt: 18 }, { hpt: 10 },
    { hpt: 18 }, { hpt: 20 }, { hpt: 10 }, { hpt: 18 },
    { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 10 }, { hpt: 18 },
    { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 24 },
  ];

  ws["!ref"] = "A1:F31";
  XLSX.utils.book_append_sheet(wb, ws, "GP");
  XLSX.writeFile(wb, `Formulario_GP_${new Date().getFullYear()}_${perfil.cedula || "SRI"}.xlsx`);
}

// ─── ANEXO GASTOS PERSONALES ──────────────────────────────────────────────────
export function generarAnexoGSP({ perfil, facturas }) {
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Detalle Gastos con Proveedor ──
  const ws1 = {};
  const headers1 = ["RUC PROVEEDOR", "CANTIDAD DE COMPROBANTES", "BASE IMPONIBLE", "TIPO DE GASTO"];

  headers1.forEach((h, i) => {
    const col = String.fromCharCode(65 + i);
    ws1[`${col}1`] = { v: h, t: "s", s: cellStyle({ bold: true, bg: VERDE, fontColor: BLANCO, align: "center" }) };
  });

  // Map categorias to SRI nombres
  const sriMap = {
    "Alimentación": "ALIMENTACION",
    "Salud": "SALUD",
    "Educación": "EDUCACION ARTE Y CULTURA",
    "Vivienda": "VIVIENDA",
    "Vestimenta": "VESTIMENTA",
    "Turismo": "TURISMO",
  };

  const deducibles = facturas.filter(f => f.sri && sriMap[f.categoria]);

  deducibles.forEach((f, i) => {
    const row = i + 2;
    const isEven = i % 2 === 0;
    const bg = isEven ? BLANCO : GRIS;
    ws1[`A${row}`] = { v: f.ruc || "", t: "s", s: cellStyle({ bg }) };
    ws1[`B${row}`] = { v: f.comprobantes || 1, t: "n", s: cellStyle({ bg, align: "center" }) };
    ws1[`C${row}`] = { v: parseFloat(fmt(f.monto)), t: "n", s: cellStyle({ bg, align: "right" }) };
    ws1[`D${row}`] = { v: sriMap[f.categoria] || f.categoria.toUpperCase(), t: "s", s: cellStyle({ bg }) };
  });

  // Total row
  const totalRow = deducibles.length + 2;
  ws1[`A${totalRow}`] = { v: "TOTAL", t: "s", s: cellStyle({ bold: true, bg: AMARILLO, align: "right" }) };
  ws1[`B${totalRow}`] = { v: deducibles.reduce((a, b) => a + (b.comprobantes || 1), 0), t: "n", s: cellStyle({ bold: true, bg: AMARILLO, align: "center" }) };
  ws1[`C${totalRow}`] = { v: parseFloat(fmt(deducibles.reduce((a, b) => a + b.monto, 0))), t: "n", s: cellStyle({ bold: true, bg: AMARILLO, align: "right" }) };
  ws1[`D${totalRow}`] = { v: "", t: "s", s: cellStyle({ bg: AMARILLO }) };

  ws1["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 30 }];
  ws1["!ref"] = `A1:D${totalRow}`;
  XLSX.utils.book_append_sheet(wb, ws1, "Detalle Gastos con Proveedor");

  // ── Hoja 2: Pensión Alimenticia ──
  const ws2 = {};
  const headers2 = ["TIPO ID BENEFICIARIO PENSIÓN ALIMENTICIA", "NÚMERO ID BENEFICIARIO PENSIÓN ALIMENTICIA", "MONTO PENSIONES ALIMENTICIAS", "TIPO DE GASTO"];
  headers2.forEach((h, i) => {
    const col = String.fromCharCode(65 + i);
    ws2[`${col}1`] = { v: h, t: "s", s: cellStyle({ bold: true, bg: VERDE, fontColor: BLANCO, align: "center", wrap: true }) };
  });
  // Empty row placeholder
  ws2["A2"] = { v: "", t: "s", s: cellStyle({}) };
  ws2["B2"] = { v: "", t: "s", s: cellStyle({}) };
  ws2["C2"] = { v: "", t: "s", s: cellStyle({}) };
  ws2["D2"] = { v: "", t: "s", s: cellStyle({}) };
  ws2["!cols"] = [{ wch: 40 }, { wch: 40 }, { wch: 25 }, { wch: 30 }];
  ws2["!rows"] = [{ hpt: 40 }, { hpt: 20 }];
  ws2["!ref"] = "A1:D2";
  XLSX.utils.book_append_sheet(wb, ws2, "Detalle GSP Pensión Alimenticia");

  // ── Hoja 3: Valor no cubierto por aseguradora ──
  const ws3 = {};
  ws3["A1"] = { v: "VALORES NO CUBIERTOS POR ASEGURADORAS", t: "s", s: cellStyle({ bold: true, bg: VERDE, fontColor: BLANCO, align: "center" }) };
  ws3["A2"] = { v: 0, t: "n", s: cellStyle({ align: "right" }) };
  ws3["!cols"] = [{ wch: 45 }];
  ws3["!ref"] = "A1:A2";
  XLSX.utils.book_append_sheet(wb, ws3, "GSP ValorNoCubiertoAseguradora");

  XLSX.writeFile(wb, `Anexo_GSP_${new Date().getFullYear()}_${perfil.cedula || "SRI"}.xlsx`);
}
