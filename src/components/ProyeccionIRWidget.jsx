import { useNavigate } from "react-router-dom";
import { C } from "../theme";
import Icon from "./Icon";
import { calcularIR } from "../data/tablaIR";

function fmt(n) {
  return `$${n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MESES_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const TIPOS_DEPENDENCIA = ["dependencia_pura", "dependencia_con_extras"];
const TIPOS_RIMPE = ["rimpe_emprendedor", "rimpe_negocio_popular"];

export default function ProyeccionIRWidget({ facturas, perfil, tipoContribuyente }) {
  const navigate = useNavigate();
  const now = new Date();
  const anio = now.getFullYear();
  const mesesTranscurridos = now.getMonth() + 1; // 1–12
  const porcentajeAnio = Math.round((mesesTranscurridos / 12) * 100);

  // Income: ventas del año actual
  const ventasAnio = facturas
    .filter(f => f.esVenta && f.fecha?.startsWith(String(anio)))
    .reduce((acc, f) => acc + (f.monto || 0), 0);

  // Ingresos acumulados según tipo
  let ingresosAcumulados = 0;
  if (TIPOS_DEPENDENCIA.includes(tipoContribuyente)) {
    const ingresoNeto = parseFloat(perfil.ingresoMensualDependencia || perfil.salario || 0);
    ingresosAcumulados = ingresoNeto * mesesTranscurridos + ventasAnio;
  } else {
    const otros = parseFloat(perfil.otrosIngresos || 0) * mesesTranscurridos;
    ingresosAcumulados = ventasAnio + otros;
  }

  // Annualize (project to end of year)
  const ingresosAnualizados = mesesTranscurridos > 0
    ? (ingresosAcumulados / mesesTranscurridos) * 12
    : 0;

  // Deductibles: gastos personales clasificados del año anterior (approx 15% of current spend)
  const gastosSriAnio = facturas
    .filter(f => !f.esVenta && f.sri && f.fecha?.startsWith(String(anio)))
    .reduce((acc, f) => acc + (f.monto || 0), 0);
  const gastosAnualizados = mesesTranscurridos > 0
    ? (gastosSriAnio / mesesTranscurridos) * 12
    : 0;

  const irEstimado = calcularIR(ingresosAnualizados, gastosAnualizados, tipoContribuyente);
  const esDependenciaPura = tipoContribuyente === "dependencia_pura";
  const esRimpe = TIPOS_RIMPE.includes(tipoContribuyente);

  const irColor = irEstimado === 0 ? C.greenAccent : irEstimado < 500 ? C.blue : C.orange;

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    }}>
      {/* Header */}
      <div style={{
        padding: "18px 20px 14px", borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.green + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="trending_up" color={C.green} size={18} />
          </div>
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Proyección IR {anio}</p>
        </div>
        <button
          onClick={() => navigate("/proyeccion-ir")}
          style={{ color: C.greenAccent, fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}
        >
          Ver completo →
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 20px" }}>
        {/* Progress year */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ color: C.textMid, fontSize: 12 }}>
              Llevas <strong style={{ color: C.text }}>{mesesTranscurridos}</strong> de 12 meses del año
            </span>
            <span style={{ color: C.textDim, fontSize: 11 }}>
              {MESES_ES[now.getMonth()]} {anio}
            </span>
          </div>
          <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
            <div style={{
              height: "100%", borderRadius: 3, background: C.green,
              width: `${porcentajeAnio}%`, transition: "width 0.6s ease",
            }} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: C.surface, borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              Ingresos acumulados
            </p>
            <p style={{ color: C.text, fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
              {fmt(ingresosAcumulados)}
            </p>
          </div>
          <div style={{ background: C.surface, borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              IR estimado anual
            </p>
            <p style={{ color: irColor, fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
              {irEstimado === 0 ? "$0" : fmt(irEstimado)}
            </p>
          </div>
        </div>

        {/* Notes */}
        {esDependenciaPura && irEstimado === 0 && (
          <p style={{ color: C.greenAccent, fontSize: 11, marginTop: 10, display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="check_circle" color={C.greenAccent} size={14} />
            Bajo la fracción básica exenta — posiblemente no pagues IR adicional
          </p>
        )}
        {esDependenciaPura && irEstimado > 0 && (
          <p style={{ color: C.textDim, fontSize: 11, marginTop: 10 }}>
            Tu empresa retiene en la fuente. Aquí ves si habrá pago adicional al declarar.
          </p>
        )}
        {esRimpe && (
          <p style={{ color: C.textDim, fontSize: 11, marginTop: 10 }}>
            Calculado con tabla IR RIMPE {anio}.
          </p>
        )}
        {!perfil.ingresoMensualDependencia && TIPOS_DEPENDENCIA.includes(tipoContribuyente) && (
          <p style={{ color: C.orange, fontSize: 11, marginTop: 10, display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="warning" color={C.orange} size={13} />
            Agrega tu sueldo en Ajustes para una proyección más exacta
          </p>
        )}
      </div>
    </div>
  );
}
