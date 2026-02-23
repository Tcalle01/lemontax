import * as XLSX from "xlsx";

// ─── Colores SRI ──────────────────────────────────────────────────────────────
const VERDE = "1A3A2A";
const AMARILLO = "F5E642";
const BLANCO = "FFFFFF";
const GRIS = "F2F2F2";
const VERDE_CLARO = "E8F5E9";
const NEGRO = "000000";

// Colores exactos del formulario oficial SRI
const LILA = "CCCCFF";          // fondo campos de código (101-115)
const MARINO = "000080";        // texto azul marino oficial
const AZUL_CATAS = "00B0F0";    // sección enfermedad catastrófica y cargas
const AZUL_CANASTA = "9DC3E6";  // valor canasta familiar básica

function cellStyle(opts = {}) {
  return {
    font: {
      name: "Arial",
      sz: opts.sz || 10,
      bold: opts.bold || false,
      color: { rgb: opts.fontColor || MARINO },
    },
    fill: opts.bg ? { fgColor: { rgb: opts.bg }, patternType: "solid" } : undefined,
    alignment: {
      horizontal: opts.align || "left",
      vertical: "center",
      wrapText: opts.wrap || false,
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
  ws["A1"] = { v: "DECLARACIÓN DE GASTOS PERSONALES A SER UTILIZADOS POR EL EMPLEADOR EN EL CASO DE INGRESOS EN RELACIÓN DE DEPENDENCIA", t: "s", s: cellStyle({ bold: true, sz: 11, fontColor: MARINO, bg: LILA, align: "center", wrap: true }) };
  ws["A2"] = { v: "FORMULARIO SRI-GP", t: "s", s: cellStyle({ bold: true, sz: 12, fontColor: MARINO, bg: LILA, align: "center" }) };
  ws["A3"] = { v: `EJERCICIO FISCAL: ${new Date().getFullYear()}`, t: "s", s: cellStyle({ bold: true, sz: 10, fontColor: MARINO, bg: BLANCO }) };
  ws["D3"] = { v: "CIUDAD Y FECHA DE ENTREGA/RECEPCIÓN", t: "s", s: cellStyle({ bold: true, sz: 9, fontColor: MARINO, bg: BLANCO, align: "center" }) };
  ws["E3"] = { v: "CIUDAD", t: "s", s: cellStyle({ bold: true, sz: 8, fontColor: MARINO, bg: BLANCO, align: "center" }) };
  ws["F3"] = { v: "AÑO / MES / DÍA", t: "s", s: cellStyle({ bold: true, sz: 8, fontColor: MARINO, bg: BLANCO, align: "center" }) };

  // Merge title rows
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
    { s: { r: 2, c: 3 }, e: { r: 2, c: 3 } },
  ];

  // ── Identificación del empleado ──
  ws["A5"] = { v: "Información / Identificación del empleado contribuyente (a ser llenado por el empleado)", t: "s", s: cellStyle({ bold: true, sz: 10, fontColor: MARINO, bg: LILA }) };
  ws["!merges"].push({ s: { r: 4, c: 0 }, e: { r: 4, c: 5 } });

  ws["A6"] = { v: "101", t: "s", s: cellStyle({ bold: true, bg: LILA, fontColor: MARINO, align: "center" }) };
  ws["B6"] = { v: "CÉDULA O PASAPORTE", t: "s", s: cellStyle({ bold: false, fontColor: MARINO, bg: BLANCO }) };
  ws["C6"] = { v: perfil.cedula || "", t: "s", s: cellStyle({ bold: true, fontColor: MARINO }) };
  ws["D6"] = { v: "102", t: "s", s: cellStyle({ bold: true, bg: LILA, fontColor: MARINO, align: "center" }) };
  ws["E6"] = { v: "APELLIDOS Y NOMBRES COMPLETOS", t: "s", s: cellStyle({ bold: false, fontColor: MARINO, bg: BLANCO }) };
  ws["F6"] = { v: perfil.nombre || "", t: "s", s: cellStyle({ bold: true, fontColor: MARINO }) };

  // ── Canasta familiar básica ──
  ws["!merges"].push({ s: { r: 5, c: 3 }, e: { r: 5, c: 4 } });
  ws["E7"] = { v: "VALOR USD CANASTA FAMILIAR BÁSICA", t: "s", s: cellStyle({ bold: true, sz: 9, fontColor: MARINO, bg: AZUL_CANASTA, align: "center", wrap: true }) };
  ws["F7"] = { v: canasta, t: "n", s: cellStyle({ bold: true, sz: 11, fontColor: MARINO, bg: AZUL_CANASTA, align: "center" }) };

  // ── Ingresos proyectados ──
  ws["A8"] = { v: "INGRESOS PROYECTADOS (ver Nota 1)", t: "s", s: cellStyle({ bold: true, sz: 10, fontColor: MARINO, bg: LILA }) };
  ws["!merges"].push({ s: { r: 7, c: 0 }, e: { r: 7, c: 5 } });

  const ingresosRows = [
    ["103", "(+) TOTAL INGRESOS CON ESTE EMPLEADOR (con el empleador que más ingresos perciba)", salarioAnual],
    ["104", "(+) TOTAL INGRESOS CON OTROS EMPLEADORES (en caso de haberlos)", otrosAnual],
    ["105", "(=) TOTAL INGRESOS PROYECTADOS", totalIngresos],
  ];

  ingresosRows.forEach(([cod, label, val], i) => {
    const row = 9 + i;
    const isTotal = cod === "105";
    ws[`A${row}`] = { v: cod, t: "s", s: cellStyle({ bold: true, bg: LILA, fontColor: MARINO, align: "center" }) };
    ws[`B${row}`] = { v: label, t: "s", s: cellStyle({ bold: isTotal, fontColor: MARINO, bg: BLANCO }) };
    ws["!merges"].push({ s: { r: row - 1, c: 1 }, e: { r: row - 1, c: 4 } });
    ws[`F${row}`] = { v: parseFloat(fmt(val)), t: "n", s: cellStyle({ bold: isTotal, align: "right", bg: isTotal ? AMARILLO : BLANCO, fontColor: MARINO }) };
  });

  // ── Gastos proyectados ──
  ws["A13"] = { v: "GASTOS PROYECTADOS", t: "s", s: cellStyle({ bold: true, sz: 10, fontColor: MARINO, bg: LILA }) };
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
    ws[`A${row}`] = { v: cod, t: "s", s: cellStyle({ bold: true, bg: LILA, fontColor: MARINO, align: "center" }) };
    ws[`B${row}`] = { v: label, t: "s", s: cellStyle({ bold: isTotal, fontColor: MARINO, bg: BLANCO }) };
    ws["!merges"].push({ s: { r: row - 1, c: 1 }, e: { r: row - 1, c: 4 } });
    ws[`F${row}`] = { v: parseFloat(fmt(val)), t: "n", s: cellStyle({ bold: true, align: "right", bg: isTotal ? AMARILLO : BLANCO, fontColor: MARINO }) };
  });

  // ── Rebaja y cargas ──
  ws["A22"] = { v: "113", t: "s", s: cellStyle({ bold: true, bg: AZUL_CATAS, fontColor: MARINO, align: "center" }) };
  ws["B22"] = { v: "TRABAJADOR O SUS CARGAS FAMILIARES CON DISCAPACIDAD, ENFERMEDADES CATASTRÓFICAS, RARAS O HUÉRFANAS", t: "s", s: cellStyle({ bold: true, fontColor: MARINO, bg: AZUL_CATAS, wrap: true }) };
  ws["!merges"].push({ s: { r: 21, c: 1 }, e: { r: 21, c: 4 } });
  ws["F22"] = { v: perfil.enfermedadCatastrofica ? "SI" : "NO", t: "s", s: cellStyle({ bold: true, align: "center", fontColor: MARINO }) };

  ws["A23"] = { v: "114", t: "s", s: cellStyle({ bold: true, bg: LILA, fontColor: MARINO, align: "center" }) };
  ws["B23"] = { v: "NÚMERO DE CARGAS FAMILIARES PARA REBAJA DE GASTOS PERSONALES", t: "s", s: cellStyle({ bold: true, fontColor: MARINO }) };
  ws["!merges"].push({ s: { r: 22, c: 1 }, e: { r: 22, c: 4 } });
  ws["F23"] = { v: parseInt(perfil.cargas || 0), t: "n", s: cellStyle({ bold: true, align: "center", fontColor: MARINO }) };

  ws["A24"] = { v: "115", t: "s", s: cellStyle({ bold: true, bg: LILA, fontColor: MARINO, align: "center" }) };
  ws["B24"] = { v: "REBAJA DE IMPUESTO A LA RENTA POR GASTOS PERSONALES PROYECTADOS", t: "s", s: cellStyle({ bold: true, fontColor: MARINO }) };
  ws["!merges"].push({ s: { r: 23, c: 1 }, e: { r: 23, c: 4 } });
  ws["F24"] = { v: parseFloat(fmt(rebaja)), t: "n", s: cellStyle({ bold: true, align: "right", bg: AMARILLO, fontColor: MARINO }) };

  // ── Tabla cargas familiares (referencia) ──
  ws["A26"] = { v: "Nro. Cargas", t: "s", s: cellStyle({ bold: true, sz: 8, fontColor: MARINO, bg: AZUL_CATAS, align: "center" }) };
  ws["B26"] = { v: "Nro. Canastas Básicas", t: "s", s: cellStyle({ bold: true, sz: 8, fontColor: MARINO, bg: AZUL_CATAS, align: "center" }) };
  [["0","7"],["1","9"],["2","11"],["3","14"],["4","17"],["5 o más","20"]].forEach(([nc, ncan], i) => {
    ws[`A${27+i}`] = { v: nc, t: "s", s: cellStyle({ sz: 9, fontColor: MARINO, align: "center" }) };
    ws[`B${27+i}`] = { v: ncan, t: "s", s: cellStyle({ sz: 9, fontColor: MARINO, align: "center" }) };
  });

  // ── Firmas ──
  ws["A34"] = { v: "EMPLEADOR / AGENTE DE RETENCIÓN", t: "s", s: cellStyle({ bold: true, align: "center", bg: LILA, fontColor: MARINO }) };
  ws["!merges"].push({ s: { r: 33, c: 0 }, e: { r: 33, c: 2 } });
  ws["D34"] = { v: "EMPLEADO CONTRIBUYENTE", t: "s", s: cellStyle({ bold: true, align: "center", bg: LILA, fontColor: MARINO }) };
  ws["!merges"].push({ s: { r: 33, c: 3 }, e: { r: 33, c: 5 } });
  ws["A37"] = { v: "Firma y sello", t: "s", s: cellStyle({ align: "center", fontColor: "999999" }) };
  ws["!merges"].push({ s: { r: 36, c: 0 }, e: { r: 36, c: 2 } });
  ws["D37"] = { v: "Firma", t: "s", s: cellStyle({ align: "center", fontColor: "999999" }) };
  ws["!merges"].push({ s: { r: 36, c: 3 }, e: { r: 36, c: 5 } });

  // Column widths
  ws["!cols"] = [
    { wch: 8 }, { wch: 50 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 },
  ];

  // Row heights
  ws["!rows"] = [
    { hpt: 40 }, { hpt: 24 }, { hpt: 18 }, { hpt: 10 },
    { hpt: 18 }, { hpt: 20 }, { hpt: 18 }, { hpt: 10 }, { hpt: 18 },
    { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 10 }, { hpt: 18 },
    { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 20 }, { hpt: 24 },
    { hpt: 18 }, { hpt: 18 }, { hpt: 20 }, { hpt: 10 },
    { hpt: 16 }, { hpt: 16 }, { hpt: 16 }, { hpt: 16 }, { hpt: 16 }, { hpt: 16 }, { hpt: 16 },
    { hpt: 10 }, { hpt: 10 }, { hpt: 20 }, { hpt: 10 }, { hpt: 10 }, { hpt: 30 },
  ];

  ws["!ref"] = "A1:F37";
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

  // Agrupar por RUC + tipo de gasto, sumando comprobantes y base imponible
  const agrupado = {};
  deducibles.forEach(f => {
    const key = `${f.ruc}||${f.categoria}`;
    if (!agrupado[key]) {
      agrupado[key] = {
        ruc: f.ruc || "",
        tipo: sriMap[f.categoria],
        comprobantes: 0,
        monto: 0,
      };
    }
    agrupado[key].comprobantes += f.comprobantes || 1;
    agrupado[key].monto += f.monto || 0;
  });

  const filas = Object.values(agrupado);

  filas.forEach((f, i) => {
    const row = i + 2;
    const bg = i % 2 === 0 ? BLANCO : GRIS;
    ws1[`A${row}`] = { v: f.ruc, t: "s", s: cellStyle({ bg }) };
    ws1[`B${row}`] = { v: f.comprobantes, t: "n", s: cellStyle({ bg, align: "center" }) };
    ws1[`C${row}`] = { v: parseFloat(fmt(f.monto)), t: "n", s: cellStyle({ bg, align: "right" }) };
    ws1[`D${row}`] = { v: f.tipo, t: "s", s: cellStyle({ bg }) };
  });

  // Total row
  const totalRow = filas.length + 2;
  ws1[`A${totalRow}`] = { v: "TOTAL", t: "s", s: cellStyle({ bold: true, bg: AMARILLO, align: "right" }) };
  ws1[`B${totalRow}`] = { v: filas.reduce((a, b) => a + b.comprobantes, 0), t: "n", s: cellStyle({ bold: true, bg: AMARILLO, align: "center" }) };
  ws1[`C${totalRow}`] = { v: parseFloat(fmt(filas.reduce((a, b) => a + b.monto, 0))), t: "n", s: cellStyle({ bold: true, bg: AMARILLO, align: "right" }) };
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
