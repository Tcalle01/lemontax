import { useMemo } from "react";
import { usePerfil } from "./usePerfil";
import { OBLIGACIONES_POR_TIPO, DIAS_VENCIMIENTO } from "../theme";

function getDiaVencimiento(digito) {
  if (!digito) return null;
  return DIAS_VENCIMIENTO[digito] || null;
}

// Build a date for a given year, month (1-indexed), and day
function buildDate(year, month, day) {
  // Clamp day to last day of month
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay));
}

function calcEstado(fechaVencimiento) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((fechaVencimiento.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { estado: "vencida", diasRestantes: diff };
  if (diff <= 7) return { estado: "urgente", diasRestantes: diff };
  if (diff <= 30) return { estado: "pendiente", diasRestantes: diff };
  return { estado: "futura", diasRestantes: diff };
}

function generarIvaMensual(anio, digito) {
  const dia = getDiaVencimiento(digito);
  const obligaciones = [];
  for (let mes = 1; mes <= 12; mes++) {
    // IVA del mes N vence el mes N+1
    const mesDec = mes + 1 > 12 ? 1 : mes + 1;
    const anioDec = mes + 1 > 12 ? anio + 1 : anio;
    const fechaVencimiento = dia
      ? buildDate(anioDec, mesDec, dia)
      : buildDate(anioDec, mesDec, 28); // default if no digit
    const { estado, diasRestantes } = calcEstado(fechaVencimiento);
    const mesNombre = new Date(anio, mes - 1).toLocaleString("es-EC", { month: "long" });

    obligaciones.push({
      id: `iva_mensual_${anio}_${String(mes).padStart(2, "0")}`,
      tipo: "iva_mensual",
      nombre: "Declaración de IVA",
      descripcion: `${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)} ${anio}`,
      periodo: "mensual",
      fechaVencimiento,
      estado,
      diasRestantes,
      multaEstimada: 0,
      ruta: `/obligaciones/iva/${anio}/${String(mes).padStart(2, "0")}`,
    });
  }
  return obligaciones;
}

function generarIvaSemestral(anio, digito) {
  const dia = getDiaVencimiento(digito);
  return [1, 2].map(sem => {
    // S1 (ene-jun) vence en julio, S2 (jul-dic) vence en enero siguiente
    const mesVenc = sem === 1 ? 7 : 1;
    const anioVenc = sem === 1 ? anio : anio + 1;
    const fechaVencimiento = dia
      ? buildDate(anioVenc, mesVenc, dia)
      : buildDate(anioVenc, mesVenc, 28);
    const { estado, diasRestantes } = calcEstado(fechaVencimiento);
    return {
      id: `iva_semestral_${anio}_S${sem}`,
      tipo: "iva_semestral",
      nombre: "IVA Semestral",
      descripcion: sem === 1 ? `Enero – Junio ${anio}` : `Julio – Diciembre ${anio}`,
      periodo: "semestral",
      fechaVencimiento,
      estado,
      diasRestantes,
      multaEstimada: 0,
      ruta: `/obligaciones/iva-semestral/${anio}/${sem}`,
    };
  });
}

function generarIrAnual(anio, digito, esRimpe) {
  const dia = getDiaVencimiento(digito);
  // IR general: marzo (roughly); IR RIMPE: mayo
  const mesVenc = esRimpe ? 5 : 3;
  const anioVenc = anio + 1; // IR for year X is declared in year X+1
  const fechaVencimiento = dia
    ? buildDate(anioVenc, mesVenc, dia)
    : buildDate(anioVenc, mesVenc, 28);
  const { estado, diasRestantes } = calcEstado(fechaVencimiento);
  return {
    id: `ir_anual_${anio}`,
    tipo: esRimpe ? "ir_anual_rimpe" : "ir_anual",
    nombre: esRimpe ? "Impuesto a la Renta (RIMPE)" : "Impuesto a la Renta",
    descripcion: `Año fiscal ${anio}`,
    periodo: "anual",
    fechaVencimiento,
    estado,
    diasRestantes,
    multaEstimada: 0,
    ruta: `/obligaciones/renta/${anio}`,
  };
}

function generarAgp(anio, digito) {
  const dia = getDiaVencimiento(digito);
  // AGP for year X is due in february X+1
  const fechaVencimiento = dia
    ? buildDate(anio + 1, 2, dia)
    : buildDate(anio + 1, 2, 28);
  const { estado, diasRestantes } = calcEstado(fechaVencimiento);
  return {
    id: `agp_${anio}`,
    tipo: "agp",
    nombre: "Gastos Personales (AGP)",
    descripcion: `Año fiscal ${anio}`,
    periodo: "anual",
    fechaVencimiento,
    estado,
    diasRestantes,
    multaEstimada: 0,
    ruta: `/obligaciones/gastos-personales/${anio}`,
  };
}

export function useObligaciones() {
  const { tipoContribuyente, novenoDigitoRuc, loading: perfilLoading } = usePerfil();

  const obligaciones = useMemo(() => {
    if (!tipoContribuyente) return [];

    const tipos = OBLIGACIONES_POR_TIPO[tipoContribuyente] || [];
    const anio = new Date().getFullYear();
    const digito = novenoDigitoRuc;
    const result = [];

    for (const tipo of tipos) {
      if (tipo === "iva_mensual") {
        result.push(...generarIvaMensual(anio, digito));
      } else if (tipo === "iva_semestral") {
        result.push(...generarIvaSemestral(anio, digito));
      } else if (tipo === "ir_anual") {
        result.push(generarIrAnual(anio - 1, digito, false)); // declaring last year
      } else if (tipo === "ir_anual_rimpe") {
        result.push(generarIrAnual(anio - 1, digito, true));
      } else if (tipo === "agp") {
        result.push(generarAgp(anio - 1, digito));
      }
    }

    // Sort: vencida > urgente > pendiente > futura > presentada
    const orden = { vencida: 0, urgente: 1, pendiente: 2, futura: 3, presentada: 4 };
    result.sort((a, b) => (orden[a.estado] ?? 5) - (orden[b.estado] ?? 5) || a.fechaVencimiento - b.fechaVencimiento);

    return result;
  }, [tipoContribuyente, novenoDigitoRuc]);

  return { obligaciones, loading: perfilLoading };
}
