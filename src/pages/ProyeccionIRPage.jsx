import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C, TIPOS_CONTRIBUYENTE } from "../theme";
import Icon from "../components/Icon";
import { useAuth } from "../auth";
import { usePerfil } from "../hooks/usePerfil";
import { supabase } from "../supabase";
import { calcularIR } from "../data/tablaIR";

function fmt(n, decimals = 2) {
  return `$${Math.abs(n).toLocaleString("es-EC", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

const TIPOS_DEPENDENCIA = ["dependencia_pura", "dependencia_con_extras"];
const TIPOS_RIMPE = ["rimpe_emprendedor", "rimpe_negocio_popular"];
const MESES_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function LineItem({ label, value, isTotal, isNegative, indent, color }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: isTotal ? "12px 0" : "8px 0",
      borderTop: isTotal ? `1px solid ${C.border}` : "none",
      marginTop: isTotal ? 4 : 0,
      paddingLeft: indent ? 16 : 0,
    }}>
      <span style={{ color: isTotal ? C.text : C.textMid, fontSize: isTotal ? 14 : 13, fontWeight: isTotal ? 700 : 400 }}>
        {label}
      </span>
      <span style={{
        color: color || (isNegative ? C.greenAccent : isTotal ? C.text : C.textMid),
        fontSize: isTotal ? 15 : 13,
        fontWeight: isTotal ? 800 : 600,
        fontFamily: isTotal ? "Syne, sans-serif" : "DM Sans, sans-serif",
      }}>
        {isNegative && value > 0 ? "−" : ""}{fmt(value)}
      </span>
    </div>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name={icon} color={C.green} size={18} />
        <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{title}</p>
      </div>
      <div style={{ padding: "4px 20px 16px" }}>
        {children}
      </div>
    </div>
  );
}

export default function ProyeccionIRPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { perfil, tipoContribuyente } = usePerfil();
  const [facturas, setFacturas] = useState([]);
  const [agpData, setAgpData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ingresosExtra, setIngresosExtra] = useState(0); // slider value

  const anio = new Date().getFullYear();
  const anioAgp = anio - 1;
  const mesesTranscurridos = new Date().getMonth() + 1;

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      supabase.from("facturas").select("*").eq("user_id", user.id).gte("fecha", `${anio}-01-01`).lte("fecha", `${anio}-12-31`),
      supabase.from("declaraciones_agp").select("total_deducible").eq("user_id", user.id).eq("anio_fiscal", anioAgp).maybeSingle(),
    ]).then(([resFacturas, resAgp]) => {
      if (resFacturas.value?.data) setFacturas(resFacturas.value.data);
      if (resAgp.value?.data) setAgpData(resAgp.value.data);
      setLoading(false);
    });
  }, [user, anio, anioAgp]);

  if (loading) {
    return (
      <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
        <p style={{ color: C.textDim, fontSize: 13 }}>Cargando...</p>
      </div>
    );
  }

  // ── Income calculations ──────────────────────────────────────────
  const esDependencia = TIPOS_DEPENDENCIA.includes(tipoContribuyente);
  const esRimpe = TIPOS_RIMPE.includes(tipoContribuyente);

  const ingresoNetoMensual = parseFloat(perfil.ingresoMensualDependencia || 0);
  const salarioNeto = esDependencia ? ingresoNetoMensual * 12 : 0;

  const ventasAnio = facturas
    .filter(f => f.es_venta)
    .reduce((acc, f) => acc + (f.monto || 0), 0);

  const otrosIngresosAnual = parseFloat(perfil.otrosIngresos || 0) * 12;

  let totalIngresos = 0;
  if (esDependencia) {
    totalIngresos = salarioNeto + ventasAnio + otrosIngresosAnual;
  } else {
    totalIngresos = ventasAnio + otrosIngresosAnual;
  }

  // Annualize if we haven't completed the year
  const factorAnualizacion = mesesTranscurridos < 12 ? 12 / mesesTranscurridos : 1;
  const totalIngresosAnualizados = totalIngresos * factorAnualizacion;

  // ── Deduction calculations ────────────────────────────────────────
  const gastosPersonalesAgp = agpData?.total_deducible
    ? parseFloat(agpData.total_deducible)
    : facturas
        .filter(f => !f.es_venta && f.es_deducible_sri && f.categoria && f.categoria !== "Otros")
        .reduce((acc, f) => acc + (f.monto || 0), 0) * factorAnualizacion;

  // Business expenses (compras deducibles del negocio, only for non-dependencia-pura)
  const gastosNegocio = tipoContribuyente !== "dependencia_pura"
    ? facturas.filter(f => !f.es_venta && f.es_deducible_sri).reduce((acc, f) => acc + (f.monto || 0), 0) * factorAnualizacion
    : 0;

  // For dependencia: don't double-count GP in gastos negocio
  const gastosNegocioNeto = esDependencia
    ? Math.max(0, gastosNegocio - gastosPersonalesAgp)
    : gastosNegocio;

  const totalDeducciones = gastosPersonalesAgp + (esDependencia ? 0 : gastosNegocioNeto);
  const totalDeduccionesGeneral = gastosPersonalesAgp + gastosNegocioNeto;

  // ── IR calculations ───────────────────────────────────────────────
  const baseImponible = Math.max(0, totalIngresosAnualizados - totalDeduccionesGeneral);
  const irConDeducciones = calcularIR(totalIngresosAnualizados, totalDeduccionesGeneral, tipoContribuyente);
  const irSinDeducciones = calcularIR(totalIngresosAnualizados, 0, tipoContribuyente);
  const ahorroDeducciones = Math.max(0, irSinDeducciones - irConDeducciones);

  // Simulator
  const ingresosConExtra = totalIngresosAnualizados + ingresosExtra;
  const irConExtra = calcularIR(ingresosConExtra, totalDeduccionesGeneral, tipoContribuyente);
  const irAdicionalExtra = Math.max(0, irConExtra - irConDeducciones);

  const metaTipo = TIPOS_CONTRIBUYENTE[tipoContribuyente] || {};
  const esDependenciaPura = tipoContribuyente === "dependencia_pura";

  const irColor = irConDeducciones === 0 ? C.greenAccent : irConDeducciones < 1000 ? C.blue : irConDeducciones < 5000 ? C.orange : "#E53935";

  return (
    <div style={{ padding: "32px", overflowY: "auto", flex: 1, maxWidth: 760, margin: "0 auto" }}>
      <style>{`
        input[type="range"] {
          -webkit-appearance: none; width: 100%; height: 6px;
          border-radius: 3px; background: ${C.border}; outline: none;
          accent-color: ${C.green};
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 20px; height: 20px; border-radius: 50%;
          background: ${C.green}; cursor: pointer;
          box-shadow: 0 2px 6px rgba(26,58,42,0.3);
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => navigate(-1)} style={{
          background: "none", border: "none", cursor: "pointer",
          color: C.textMid, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 4,
          fontFamily: "DM Sans, sans-serif", padding: 0, marginBottom: 16,
        }}>
          <Icon name="arrow_back" color={C.textMid} size={16} /> Volver
        </button>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
              Proyección IR {anio}
            </h1>
            <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>
              {metaTipo.descripcion || tipoContribuyente} · datos al mes {MESES_ES[new Date().getMonth()]}
            </p>
          </div>
          <div style={{
            background: C.green + "12", borderRadius: 10, padding: "8px 14px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Icon name="update" color={C.green} size={15} />
            <span style={{ color: C.green, fontSize: 12, fontWeight: 600 }}>
              {mesesTranscurridos}/12 meses
            </span>
          </div>
        </div>
      </div>

      {/* Annualization notice */}
      {mesesTranscurridos < 12 && (
        <div style={{
          background: C.blue + "12", border: `1px solid ${C.blue}30`,
          borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <Icon name="info" color={C.blue} size={18} />
          <p style={{ color: C.textMid, fontSize: 12, lineHeight: 1.5 }}>
            Los valores están <strong>proyectados al año completo</strong> asumiendo que tus ingresos y gastos se mantienen similares al ritmo actual.
          </p>
        </div>
      )}

      {/* Note for dependencia_pura */}
      {esDependenciaPura && (
        <div style={{
          background: C.yellow + "18", border: `1px solid ${C.yellow}50`,
          borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <Icon name="work" color="#D4A017" size={18} />
          <p style={{ color: C.textMid, fontSize: 12, lineHeight: 1.6 }}>
            <strong style={{ color: C.text }}>Trabajas en relación de dependencia.</strong> Tu empleador ya retiene el IR mes a mes. Esta proyección te ayuda a ver si habrá un <strong>pago adicional o devolución</strong> cuando declares en marzo del año siguiente.
          </p>
        </div>
      )}

      {/* Missing income warning */}
      {esDependencia && !perfil.ingresoMensualDependencia && (
        <div onClick={() => navigate("/ajustes")} style={{
          background: C.orange + "10", border: `1px solid ${C.orange}40`,
          borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        }}>
          <Icon name="warning" color={C.orange} size={18} />
          <div style={{ flex: 1 }}>
            <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>Falta tu sueldo mensual</p>
            <p style={{ color: C.textMid, fontSize: 12 }}>Agrégalo en Ajustes para una proyección exacta →</p>
          </div>
        </div>
      )}

      {/* A. Ingresos */}
      <SectionCard title="Ingresos proyectados" icon="payments">
        {esDependencia && (
          <LineItem
            label={`Relación de dependencia (${ingresoNetoMensual > 0 ? `$${ingresoNetoMensual.toFixed(0)}/mes neto` : "sueldo no configurado"})`}
            value={salarioNeto * factorAnualizacion}
            indent
          />
        )}
        <LineItem label="Facturas emitidas (ventas del año)" value={ventasAnio * factorAnualizacion} indent />
        {otrosIngresosAnual > 0 && (
          <LineItem label="Otros ingresos" value={otrosIngresosAnual} indent />
        )}
        <LineItem label="Total ingresos estimados" value={totalIngresosAnualizados} isTotal />
      </SectionCard>

      {/* B. Deducciones */}
      <SectionCard title="Deducciones" icon="remove_circle">
        <LineItem
          label={`Gastos personales — AGP ${agpData ? `(${anioAgp} declarado)` : `(${anio} en curso)`}`}
          value={gastosPersonalesAgp}
          isNegative
          indent
        />
        {tipoContribuyente !== "dependencia_pura" && gastosNegocioNeto > 0 && (
          <LineItem
            label="Gastos del negocio (compras deducibles)"
            value={gastosNegocioNeto}
            isNegative
            indent
          />
        )}
        {totalDeduccionesGeneral === 0 && (
          <p style={{ color: C.textDim, fontSize: 12, padding: "8px 0" }}>
            Sin deducciones registradas aún
          </p>
        )}
        <LineItem label="Total deducciones" value={totalDeduccionesGeneral} isTotal isNegative />
      </SectionCard>

      {/* C. Resultado */}
      <div style={{
        background: C.cardDark, borderRadius: 16, padding: "24px", marginBottom: 16,
      }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            Base imponible estimada
          </p>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 20, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
            {fmt(baseImponible)}
          </p>
          {baseImponible === 0 && totalIngresosAnualizados > 0 && (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>
              Las deducciones cubren todos tus ingresos
            </p>
          )}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 20 }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            {esRimpe ? "Cuota IR RIMPE estimada" : "Impuesto a la Renta estimado"}
          </p>
          <p style={{ color: irColor, fontSize: 36, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
            {irConDeducciones === 0 ? "$0" : fmt(irConDeducciones)}
          </p>
          {irConDeducciones === 0 && (
            <p style={{ color: C.greenAccent, fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Icon name="check_circle" color={C.greenAccent} size={14} />
              Bajo la fracción básica exenta — no pagas IR
            </p>
          )}
          {esRimpe && (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 6 }}>
              Tabla IR RIMPE {anio}. ⚠ Verifica en sri.gob.ec
            </p>
          )}
        </div>
      </div>

      {/* D. Simulador */}
      <SectionCard title="Simulador: ¿Qué pasa si facturas más?" icon="calculate">
        <div style={{ paddingTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: C.textMid, fontSize: 13 }}>Ingresos adicionales este año</span>
            <span style={{ color: C.text, fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
              {fmt(ingresosExtra, 0)}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={50000}
            step={500}
            value={ingresosExtra}
            onChange={e => setIngresosExtra(Number(e.target.value))}
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: "flex", gap: 4, justifyContent: "space-between", marginBottom: 16 }}>
            {["$0", "$10k", "$20k", "$30k", "$40k", "$50k"].map(l => (
              <span key={l} style={{ color: C.textDim, fontSize: 10 }}>{l}</span>
            ))}
          </div>

          {ingresosExtra > 0 ? (
            <div style={{ background: C.surface, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: C.textMid, fontSize: 13 }}>IR actual estimado</span>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{fmt(irConDeducciones)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: C.textMid, fontSize: 13 }}>IR con {fmt(ingresosExtra, 0)} más</span>
                <span style={{ color: irAdicionalExtra > 0 ? C.orange : C.greenAccent, fontSize: 13, fontWeight: 700 }}>
                  {fmt(irConExtra)}
                </span>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>IR adicional</span>
                <span style={{ color: irAdicionalExtra > 0 ? C.orange : C.greenAccent, fontSize: 14, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
                  {irAdicionalExtra > 0 ? `+${fmt(irAdicionalExtra)}` : "$0"}
                </span>
              </div>
            </div>
          ) : (
            <p style={{ color: C.textDim, fontSize: 12, textAlign: "center", padding: "8px 0" }}>
              Mueve el slider para simular ingresos adicionales
            </p>
          )}
        </div>
      </SectionCard>

      {/* E. Comparación con/sin deducciones */}
      {(irSinDeducciones > 0 || irConDeducciones > 0) && (
        <SectionCard title="Impacto de tus deducciones" icon="compare_arrows">
          <div style={{ paddingTop: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ background: "#FEF2F2", borderRadius: 12, padding: "14px 16px", border: `1px solid #FECACA` }}>
                <p style={{ color: "#DC2626", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                  Sin deducciones
                </p>
                <p style={{ color: "#DC2626", fontSize: 20, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
                  {fmt(irSinDeducciones)}
                </p>
              </div>
              <div style={{ background: C.greenAccent + "10", borderRadius: 12, padding: "14px 16px", border: `1px solid ${C.greenAccent}30` }}>
                <p style={{ color: C.greenAccent, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
                  Con tus deducciones
                </p>
                <p style={{ color: C.greenAccent, fontSize: 20, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
                  {fmt(irConDeducciones)}
                </p>
              </div>
            </div>

            {ahorroDeducciones > 0 && (
              <div style={{ background: C.green, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="savings" color={C.yellow} size={20} />
                  <span style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>Ahorras gracias a tus deducciones</span>
                </div>
                <span style={{ color: C.yellow, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
                  {fmt(ahorroDeducciones)}
                </span>
              </div>
            )}

            {ahorroDeducciones === 0 && totalDeduccionesGeneral === 0 && (
              <div onClick={() => navigate(`/obligaciones/gastos-personales/${anioAgp}`)} style={{
                background: C.surface, borderRadius: 12, padding: "12px 16px",
                border: `1px dashed ${C.border}`, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Icon name="lightbulb" color={C.yellow} size={18} />
                <p style={{ color: C.textMid, fontSize: 12, flex: 1 }}>
                  Clasifica tus gastos personales (AGP) para reducir tu IR
                </p>
                <Icon name="chevron_right" color={C.textDim} size={16} />
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Disclaimer */}
      <div style={{ padding: "16px 0 8px" }}>
        <p style={{ color: C.textDim, fontSize: 11, lineHeight: 1.6, textAlign: "center" }}>
          Esta es una estimación orientativa basada en las tablas IR 2025 del SRI Ecuador.<br />
          Para tu declaración oficial, consulta con un contador autorizado.
        </p>
      </div>
    </div>
  );
}
