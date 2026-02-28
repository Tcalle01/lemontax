import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C } from "../theme";
import Icon from "../components/Icon";
import { useAuth } from "../auth";
import { usePerfil } from "../hooks/usePerfil";
import { supabase } from "../supabase";
import { calcularIR } from "../data/tablaIR";
import { descargarArchivoIR } from "../utils/generarArchivoIR";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_DEPENDENCIA = ["dependencia_pura", "dependencia_con_extras"];
const TIPOS_RIMPE = ["rimpe_emprendedor", "rimpe_negocio_popular"];
const TIPOS_CON_FACTURACION = [
  "freelancer_general", "rimpe_emprendedor", "rimpe_negocio_popular",
  "arrendador_general", "dependencia_con_extras",
];
const CATS_AGP = ["Salud", "Educación", "Alimentación", "Vivienda", "Vestimenta"];

function getPasos(tipo) {
  const esRimpe = TIPOS_RIMPE.includes(tipo);
  if (esRimpe) {
    return [
      { id: "ingresos", titulo: "¿Cuánto ganaste?" },
      { id: "retenciones", titulo: "¿Te hicieron retenciones?" },
      { id: "resumen", titulo: "Resumen y resultado" },
    ];
  }
  if (tipo === "dependencia_pura") {
    return [
      { id: "ingresos", titulo: "¿Cuánto ganaste?" },
      { id: "gastos_personales", titulo: "Tus gastos personales" },
      { id: "retenciones", titulo: "¿Te hicieron retenciones?" },
      { id: "resumen", titulo: "Resumen y resultado" },
    ];
  }
  return [
    { id: "ingresos", titulo: "¿Cuánto ganaste?" },
    { id: "gastos_negocio", titulo: "Gastos de tu negocio" },
    { id: "gastos_personales", titulo: "Tus gastos personales" },
    { id: "retenciones", titulo: "¿Te hicieron retenciones?" },
    { id: "resumen", titulo: "Resumen y resultado" },
  ];
}

// ─── Helpers de formato ───────────────────────────────────────────────────────

function fmtDinero(n) {
  const abs = Math.abs(n || 0);
  return `$${abs.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function parseNum(v) {
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function BarraProgreso({ pasos, pasoActual }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10 }}>
        {pasos.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", flex: i < pasos.length - 1 ? 1 : "unset" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: i < pasoActual ? C.greenAccent : i === pasoActual ? C.green : C.border,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.3s",
            }}>
              {i < pasoActual
                ? <Icon name="check" color="#fff" size={15} />
                : <span style={{ color: i === pasoActual ? "#fff" : C.textDim, fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
              }
            </div>
            {i < pasos.length - 1 && (
              <div style={{
                flex: 1, height: 3, margin: "0 4px",
                background: i < pasoActual ? C.greenAccent : C.border,
                borderRadius: 2, transition: "background 0.3s",
              }} />
            )}
          </div>
        ))}
      </div>
      <p style={{ color: C.textMid, fontSize: 12 }}>
        Paso {pasoActual + 1} de {pasos.length} — <strong style={{ color: C.text }}>{pasos[pasoActual]?.titulo}</strong>
      </p>
    </div>
  );
}

function CampoNumerico({ label, value, onChange, hint, readOnly, prefix = "$", autoFilled }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ color: C.textMid, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </label>
        {autoFilled && (
          <span style={{
            background: C.green + "12", color: C.green, fontSize: 10, fontWeight: 700,
            padding: "2px 8px", borderRadius: 6, letterSpacing: 0.3,
          }}>
            Auto
          </span>
        )}
      </div>
      <div style={{
        display: "flex", alignItems: "center",
        background: readOnly ? C.surface : "#fff",
        borderRadius: 12, border: `1.5px solid ${readOnly ? C.border : C.green + "40"}`,
        overflow: "hidden",
      }}>
        <span style={{ padding: "0 10px 0 14px", color: readOnly ? C.textDim : C.green, fontSize: 14, fontWeight: 700 }}>
          {prefix}
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={readOnly ? parseFloat(value || 0).toFixed(2) : (value === 0 ? "" : value)}
          readOnly={readOnly}
          onChange={readOnly ? undefined : (e => onChange(parseNum(e.target.value)))}
          placeholder={readOnly ? undefined : "0.00"}
          style={{
            flex: 1, padding: "12px 14px 12px 0", background: "transparent",
            border: "none", outline: "none", fontSize: 14,
            color: readOnly ? C.textDim : C.text,
            fontFamily: "DM Sans, sans-serif", fontWeight: 600,
            cursor: readOnly ? "default" : "text",
          }}
        />
      </div>
      {hint && (
        <p style={{ color: C.textDim, fontSize: 11, marginTop: 5, lineHeight: 1.5 }}>{hint}</p>
      )}
    </div>
  );
}

function ListaFacturas({ facturas }) {
  const [expandido, setExpandido] = useState(false);
  if (!facturas.length) return null;
  const visible = expandido ? facturas : facturas.slice(0, 3);
  return (
    <div style={{ marginTop: 10, background: C.surface, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
      {visible.map((f, i) => (
        <div key={f.id || i} style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 14px", borderBottom: i < visible.length - 1 ? `1px solid ${C.border}` : "none",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: C.text, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.emisor || "Sin nombre"}
            </p>
            <p style={{ color: C.textDim, fontSize: 10 }}>{f.fecha}</p>
          </div>
          <p style={{ color: C.text, fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>
            {fmtDinero(f.monto)}
          </p>
        </div>
      ))}
      {facturas.length > 3 && (
        <button onClick={() => setExpandido(v => !v)} style={{
          width: "100%", padding: "8px", background: "none", border: "none",
          cursor: "pointer", color: C.green, fontSize: 12, fontWeight: 600,
          fontFamily: "DM Sans, sans-serif",
        }}>
          {expandido ? "Ver menos ↑" : `Ver ${facturas.length - 3} más ↓`}
        </button>
      )}
    </div>
  );
}

function FilaResumen({ label, value, bold, isNegative, indent, highlight }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: bold ? "12px 0" : "8px 0",
      borderTop: bold ? `1px solid ${C.border}` : "none",
      paddingLeft: indent ? 16 : 0,
    }}>
      <span style={{ color: bold ? C.text : C.textMid, fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 400 }}>
        {label}
      </span>
      <span style={{
        color: highlight || (isNegative ? C.greenAccent : bold ? C.text : C.textMid),
        fontSize: bold ? 15 : 13, fontWeight: bold ? 800 : 600,
        fontFamily: bold ? "Syne, sans-serif" : "DM Sans, sans-serif",
      }}>
        {isNegative && (value || 0) > 0 ? "−" : ""}{fmtDinero(value)}
      </span>
    </div>
  );
}

function ModalBase({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520,
        maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
        }}>
          <p style={{ color: C.text, fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{title}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <Icon name="close" color={C.textDim} size={20} />
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DeclaracionIRPage() {
  const { anio: anioParam } = useParams();
  const anio = parseInt(anioParam);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { perfil, tipoContribuyente } = usePerfil();

  const esDependencia = TIPOS_DEPENDENCIA.includes(tipoContribuyente);
  const esRimpe = TIPOS_RIMPE.includes(tipoContribuyente);
  const tieneFacturacion = TIPOS_CON_FACTURACION.includes(tipoContribuyente);

  const pasos = useMemo(() => getPasos(tipoContribuyente), [tipoContribuyente]);
  const [pasoActual, setPasoActual] = useState(0);

  // Datos de facturas y AGP cargados de Supabase
  const [facturas, setFacturas] = useState([]);
  const [agpData, setAgpData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modal, setModal] = useState(null); // "casillas" | "instrucciones" | "presentada"
  const [fechaPresentacion, setFechaPresentacion] = useState("");
  const [marcandoPresentada, setMarcandoPresentada] = useState(false);
  const [estadoDeclaracion, setEstadoDeclaracion] = useState("borrador");

  // Campos editables por el usuario
  const [sueldoAnual, setSueldoAnual] = useState(0);
  const [bonosExtras, setBonosExtras] = useState(0);
  const [ingresosOtros, setIngresosOtros] = useState(0);
  const [otrosGastosNegocio, setOtrosGastosNegocio] = useState(0);
  const [gpSalud, setGpSalud] = useState(0);
  const [gpEducacion, setGpEducacion] = useState(0);
  const [gpAlimentacion, setGpAlimentacion] = useState(0);
  const [gpVivienda, setGpVivienda] = useState(0);
  const [gpVestimenta, setGpVestimenta] = useState(0);
  const [retenciones, setRetenciones] = useState(0);
  const [anticipos, setAnticipos] = useState(0);

  // Cargar datos desde Supabase
  useEffect(() => {
    if (!user || !perfil._id) return;
    Promise.allSettled([
      supabase.from("facturas").select("*")
        .eq("user_id", user.id)
        .gte("fecha", `${anio}-01-01`)
        .lte("fecha", `${anio}-12-31`),
      supabase.from("declaraciones_agp").select("*")
        .eq("user_id", user.id)
        .eq("anio_fiscal", anio)
        .maybeSingle(),
      supabase.from("declaraciones_ir").select("*")
        .eq("user_id", user.id)
        .eq("anio_fiscal", anio)
        .maybeSingle(),
    ]).then(([resF, resAgp, resDec]) => {
      const fs = resF.value?.data || [];
      setFacturas(fs);

      const agp = resAgp.value?.data || null;
      setAgpData(agp);

      const dec = resDec.value?.data || null;
      if (dec) setEstadoDeclaracion(dec.estado || "borrador");

      // Pre-llenar desde declaración guardada o desde perfil/agp
      const ingresoMensual = parseFloat(perfil?.ingresoMensualDependencia || perfil?.salario || 0);
      const gastosNegAutoCalc = fs
        .filter(f => !f.es_venta && !CATS_AGP.includes(f.categoria))
        .reduce((a, f) => a + (f.monto || 0), 0);

      if (dec) {
        // Restaurar desde borrador guardado
        setSueldoAnual(dec.ingresos_dependencia || 0);
        setIngresosOtros(dec.ingresos_otros || 0);
        setOtrosGastosNegocio(Math.max(0, (dec.gastos_deducibles_negocio || 0) - gastosNegAutoCalc));
        setGpSalud(dec.gastos_personales_salud || 0);
        setGpEducacion(dec.gastos_personales_educacion || 0);
        setGpAlimentacion(dec.gastos_personales_alimentacion || 0);
        setGpVivienda(dec.gastos_personales_vivienda || 0);
        setGpVestimenta(dec.gastos_personales_vestimenta || 0);
        setRetenciones(dec.retenciones_recibidas || 0);
        setAnticipos(dec.anticipos_pagados || 0);
      } else {
        // Pre-llenar desde perfil y AGP
        setSueldoAnual(esDependencia ? ingresoMensual * 12 : 0);
        setGpSalud(agp?.total_salud || 0);
        setGpEducacion(agp?.total_educacion || 0);
        setGpAlimentacion(agp?.total_alimentacion || 0);
        setGpVivienda(agp?.total_vivienda || 0);
        setGpVestimenta(agp?.total_vestimenta || 0);
      }

      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, anio, perfil._id]);

  // ── Valores derivados ──────────────────────────────────────────────────────

  const ventasAnio = facturas.filter(f => f.es_venta);
  const totalVentas = ventasAnio.reduce((a, f) => a + (f.monto || 0), 0);

  const comprasNegocio = facturas.filter(f => !f.es_venta && !CATS_AGP.includes(f.categoria));
  const totalComprasNegocioAuto = comprasNegocio.reduce((a, f) => a + (f.monto || 0), 0);
  const totalGastosNegocio = totalComprasNegocioAuto + otrosGastosNegocio;

  const totalGP = gpSalud + gpEducacion + gpAlimentacion + gpVivienda + gpVestimenta;
  const totalDeducciones = esRimpe ? 0 : (totalGastosNegocio + totalGP);

  const ingDepTotal = sueldoAnual + bonosExtras;
  const totalIngresos = ingDepTotal + totalVentas + ingresosOtros;

  const baseImponible = esRimpe ? totalIngresos : Math.max(0, totalIngresos - totalDeducciones);
  const irCausado = calcularIR(totalIngresos, esRimpe ? 0 : totalDeducciones, tipoContribuyente);
  const irAPagar = irCausado - retenciones - anticipos;

  // ── Auto-guardar borrador ─────────────────────────────────────────────────

  async function guardarBorrador() {
    if (!user) return;
    setGuardando(true);
    try {
      await supabase.from("declaraciones_ir").upsert({
        user_id: user.id,
        anio_fiscal: anio,
        ingresos_dependencia: ingDepTotal,
        ingresos_facturacion: totalVentas,
        ingresos_otros: ingresosOtros,
        gastos_deducibles_negocio: totalGastosNegocio,
        gastos_personales_salud: gpSalud,
        gastos_personales_educacion: gpEducacion,
        gastos_personales_alimentacion: gpAlimentacion,
        gastos_personales_vivienda: gpVivienda,
        gastos_personales_vestimenta: gpVestimenta,
        base_imponible: baseImponible,
        ir_causado: irCausado,
        retenciones_recibidas: retenciones,
        anticipos_pagados: anticipos,
        ir_a_pagar: irAPagar,
        estado: estadoDeclaracion,
      }, { onConflict: "user_id,anio_fiscal" });
    } finally {
      setGuardando(false);
    }
  }

  async function avanzar() {
    await guardarBorrador();
    setPasoActual(p => Math.min(p + 1, pasos.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function retroceder() {
    setPasoActual(p => Math.max(p - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function marcarPresentada() {
    if (!fechaPresentacion) return;
    setMarcandoPresentada(true);
    await supabase.from("declaraciones_ir").upsert({
      user_id: user.id,
      anio_fiscal: anio,
      estado: "presentada",
      fecha_presentacion: fechaPresentacion,
      ingresos_dependencia: ingDepTotal,
      ingresos_facturacion: totalVentas,
      ingresos_otros: ingresosOtros,
      gastos_deducibles_negocio: totalGastosNegocio,
      gastos_personales_salud: gpSalud,
      gastos_personales_educacion: gpEducacion,
      gastos_personales_alimentacion: gpAlimentacion,
      gastos_personales_vivienda: gpVivienda,
      gastos_personales_vestimenta: gpVestimenta,
      base_imponible: baseImponible,
      ir_causado: irCausado,
      retenciones_recibidas: retenciones,
      anticipos_pagados: anticipos,
      ir_a_pagar: irAPagar,
    }, { onConflict: "user_id,anio_fiscal" });
    setEstadoDeclaracion("presentada");
    setMarcandoPresentada(false);
    setModal(null);
  }

  function handleDescargarXML() {
    descargarArchivoIR(
      {
        anio_fiscal: anio,
        ingresos_dependencia: ingDepTotal,
        ingresos_facturacion: totalVentas,
        ingresos_otros: ingresosOtros,
        gastos_deducibles_negocio: totalGastosNegocio,
        gastos_personales_salud: gpSalud,
        gastos_personales_educacion: gpEducacion,
        gastos_personales_alimentacion: gpAlimentacion,
        gastos_personales_vivienda: gpVivienda,
        gastos_personales_vestimenta: gpVestimenta,
        base_imponible: baseImponible,
        ir_causado: irCausado,
        retenciones_recibidas: retenciones,
        anticipos_pagados: anticipos,
        ir_a_pagar: irAPagar,
      },
      perfil,
      tipoContribuyente
    );
    setModal("instrucciones");
  }

  // ── Render de cada paso ───────────────────────────────────────────────────

  const pasoId = pasos[pasoActual]?.id;

  const tituloDeclaracion = esRimpe
    ? `Declaración de Renta — Régimen RIMPE ${anio}`
    : `Declaración de Impuesto a la Renta ${anio}`;

  if (loading) {
    return (
      <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
        <p style={{ color: C.textDim, fontSize: 13 }}>Cargando tu información...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px", overflowY: "auto", flex: 1, maxWidth: 680, margin: "0 auto" }}>

      {/* Header */}
      <button onClick={() => navigate(-1)} style={{
        background: "none", border: "none", cursor: "pointer", color: C.textMid,
        fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
        fontFamily: "DM Sans, sans-serif", padding: 0, marginBottom: 20,
      }}>
        <Icon name="arrow_back" color={C.textMid} size={16} /> Volver
      </button>

      <h1 style={{ color: C.text, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 4 }}>
        {tituloDeclaracion}
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
        <p style={{ color: C.textMid, fontSize: 13 }}>
          Formulario {esRimpe ? "RIMPE" : "102"} · Período fiscal {anio}
        </p>
        {estadoDeclaracion === "presentada" && (
          <span style={{
            background: C.greenAccent + "18", color: C.greenAccent,
            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <Icon name="check_circle" color={C.greenAccent} size={12} /> Presentada
          </span>
        )}
        {estadoDeclaracion === "borrador" && (
          <span style={{
            background: C.blue + "18", color: C.blue,
            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
          }}>
            Borrador
          </span>
        )}
      </div>

      {/* Barra de progreso */}
      <BarraProgreso pasos={pasos} pasoActual={pasoActual} />

      {/* ── PASO: INGRESOS ── */}
      {pasoId === "ingresos" && (
        <div>
          <h2 style={{ color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 6 }}>
            ¿Cuánto ganaste en {anio}?
          </h2>
          <p style={{ color: C.textMid, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
            Registra todos tus ingresos del año. Usamos los datos de tu cuenta para pre-llenar lo que podemos.
          </p>

          {/* Ingresos por dependencia */}
          {esDependencia && (
            <div style={{ background: C.surface, borderRadius: 14, padding: 20, marginBottom: 20, border: `1px solid ${C.border}` }}>
              <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                💼 Tu empleo en relación de dependencia
              </p>
              <CampoNumerico
                label="Sueldo neto anual (ya descontado el IESS)"
                value={sueldoAnual}
                onChange={setSueldoAnual}
                hint={`Pre-llenado desde tu perfil (${fmtDinero(parseFloat(perfil?.ingresoMensualDependencia || 0))}/mes × 12). Puedes editarlo si tuviste cambios salariales.`}
                autoFilled={!!perfil?.ingresoMensualDependencia}
              />
              <CampoNumerico
                label="Bonos, horas extras u otros ingresos de tu empleador"
                value={bonosExtras}
                onChange={setBonosExtras}
                hint="Opcional. Suma aquí cualquier pago extra que recibiste de tu empresa."
              />
            </div>
          )}

          {/* Ingresos por facturación */}
          {tieneFacturacion && (
            <div style={{ background: C.surface, borderRadius: 14, padding: 20, marginBottom: 20, border: `1px solid ${C.border}` }}>
              <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                🧾 Tus facturas emitidas en {anio}
              </p>
              <p style={{ color: C.textDim, fontSize: 12, marginBottom: 16 }}>
                {ventasAnio.length} {ventasAnio.length === 1 ? "factura de venta registrada" : "facturas de venta registradas"} en facilito
              </p>
              <div style={{
                background: C.green, borderRadius: 10, padding: "14px 18px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 12,
              }}>
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Total de ventas {anio}</span>
                <span style={{ color: C.yellow, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
                  {fmtDinero(totalVentas)}
                </span>
              </div>
              {ventasAnio.length > 0 && (
                <ListaFacturas facturas={ventasAnio} />
              )}
              {ventasAnio.length === 0 && (
                <div style={{
                  textAlign: "center", padding: "16px", color: C.textDim, fontSize: 12,
                  border: `1px dashed ${C.border}`, borderRadius: 10,
                }}>
                  No encontramos facturas de venta. Si facturaste, sincroniza tu Gmail.
                </div>
              )}
            </div>
          )}

          {/* Otros ingresos */}
          <div style={{ background: C.surface, borderRadius: 14, padding: 20, border: `1px solid ${C.border}` }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              💰 Otros ingresos (opcional)
            </p>
            <p style={{ color: C.textDim, fontSize: 12, marginBottom: 16 }}>
              Herencias, premios, venta de bienes o cualquier ingreso que no sea tu sueldo ni tus facturas.
            </p>
            <CampoNumerico
              label="Otros ingresos del año"
              value={ingresosOtros}
              onChange={setIngresosOtros}
            />
          </div>

          {/* Total */}
          <div style={{
            background: C.green, borderRadius: 14, padding: "16px 20px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 16,
          }}>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600 }}>Total ingresos {anio}</span>
            <span style={{ color: C.yellow, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
              {fmtDinero(totalIngresos)}
            </span>
          </div>
        </div>
      )}

      {/* ── PASO: GASTOS NEGOCIO ── */}
      {pasoId === "gastos_negocio" && (
        <div>
          <h2 style={{ color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 6 }}>
            ¿Cuánto gastaste en tu negocio?
          </h2>
          <p style={{ color: C.textMid, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
            Los gastos directamente relacionados con tu actividad económica reducen tu base imponible.
          </p>

          {/* Auto-calculado desde facturas */}
          <div style={{ background: C.surface, borderRadius: 14, padding: 20, marginBottom: 20, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>
                🧾 Compras registradas en facilito
              </p>
              <span style={{
                background: C.green + "12", color: C.green, fontSize: 10, fontWeight: 700,
                padding: "2px 8px", borderRadius: 6,
              }}>Auto</span>
            </div>
            <p style={{ color: C.textDim, fontSize: 12, marginBottom: 16 }}>
              Facturas de compra que no son gastos personales (Salud, Educación, Alimentación, Vivienda, Vestimenta).
            </p>
            <div style={{
              background: C.green, borderRadius: 10, padding: "14px 18px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 12,
            }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{comprasNegocio.length} facturas de compra</span>
              <span style={{ color: C.yellow, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
                {fmtDinero(totalComprasNegocioAuto)}
              </span>
            </div>
            {comprasNegocio.length > 0 && (
              <ListaFacturas facturas={comprasNegocio} />
            )}
          </div>

          {/* Otros gastos no registrados */}
          <div style={{ background: C.surface, borderRadius: 14, padding: 20, marginBottom: 16, border: `1px solid ${C.border}` }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
              ➕ Otros gastos de tu negocio
            </p>
            <p style={{ color: C.textDim, fontSize: 12, marginBottom: 16 }}>
              Gastos que tengas en papel pero no están en tus facturas de facilito. Ejemplo: arriendo de oficina, servicios básicos del negocio.
            </p>
            <CampoNumerico
              label="Gastos adicionales del negocio"
              value={otrosGastosNegocio}
              onChange={setOtrosGastosNegocio}
            />
          </div>

          {/* Nota informativa */}
          <div style={{
            background: C.blue + "10", border: `1px solid ${C.blue}25`,
            borderRadius: 12, padding: "12px 16px",
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <Icon name="info" color={C.blue} size={18} />
            <p style={{ color: C.textMid, fontSize: 12, lineHeight: 1.6 }}>
              El SRI solo acepta gastos <strong>directamente relacionados con tu actividad económica</strong>. Conserva los comprobantes por 7 años.
            </p>
          </div>

          {/* Total */}
          <div style={{
            background: C.greenAccent + "10", borderRadius: 14, padding: "16px 20px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 16, border: `1px solid ${C.greenAccent}30`,
          }}>
            <span style={{ color: C.textMid, fontSize: 14, fontWeight: 600 }}>Total gastos negocio</span>
            <span style={{ color: C.greenAccent, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
              {fmtDinero(totalGastosNegocio)}
            </span>
          </div>
        </div>
      )}

      {/* ── PASO: GASTOS PERSONALES ── */}
      {pasoId === "gastos_personales" && (
        <div>
          <h2 style={{ color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 6 }}>
            Tus gastos personales deducibles
          </h2>
          <p style={{ color: C.textMid, fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            Los gastos personales que declaraste al SRI (AGP) reducen tu base imponible. Revisa y ajusta si tienes gastos adicionales.
          </p>

          {/* Banner AGP */}
          {agpData ? (
            <div style={{
              background: C.greenAccent + "10", border: `1px solid ${C.greenAccent}30`,
              borderRadius: 12, padding: "12px 16px", marginBottom: 20,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <Icon name="check_circle" color={C.greenAccent} size={18} />
              <div style={{ flex: 1 }}>
                <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                  AGP {anio} encontrado
                </p>
                <p style={{ color: C.textDim, fontSize: 12 }}>
                  Los valores se pre-llenaron desde tu declaración de gastos personales. Puedes editarlos.
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              background: C.yellow + "18", border: `1px solid ${C.yellow}60`,
              borderRadius: 12, padding: "14px 16px", marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                <Icon name="warning" color="#D4A017" size={18} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                    Todavía no has clasificado tus gastos personales
                  </p>
                  <p style={{ color: C.textMid, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                    Esto puede reducir lo que pagas. Clasifica tus facturas antes de presentar la declaración.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/obligaciones/gastos-personales/${anio}`)}
                style={{
                  background: "#D4A017", color: "#fff", border: "none",
                  borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                }}
              >
                Ir a clasificar mis facturas →
              </button>
            </div>
          )}

          {/* Campos por categoría */}
          <div style={{ background: C.surface, borderRadius: 14, padding: 20, marginBottom: 16, border: `1px solid ${C.border}` }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
              Gastos personales por categoría
            </p>
            {[
              { label: "Salud", value: gpSalud, set: setGpSalud, icon: "medication" },
              { label: "Educación", value: gpEducacion, set: setGpEducacion, icon: "school" },
              { label: "Alimentación", value: gpAlimentacion, set: setGpAlimentacion, icon: "shopping_cart" },
              { label: "Vivienda", value: gpVivienda, set: setGpVivienda, icon: "home" },
              { label: "Vestimenta", value: gpVestimenta, set: setGpVestimenta, icon: "checkroom" },
            ].map(({ label, value, set }) => (
              <CampoNumerico
                key={label}
                label={label}
                value={value}
                onChange={set}
                autoFilled={!!agpData}
              />
            ))}
          </div>

          {/* Total GP */}
          <div style={{
            background: C.greenAccent + "10", borderRadius: 14, padding: "16px 20px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            border: `1px solid ${C.greenAccent}30`,
          }}>
            <span style={{ color: C.textMid, fontSize: 14, fontWeight: 600 }}>Total gastos personales</span>
            <span style={{ color: C.greenAccent, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
              {fmtDinero(totalGP)}
            </span>
          </div>
        </div>
      )}

      {/* ── PASO: RETENCIONES ── */}
      {pasoId === "retenciones" && (
        <div>
          <h2 style={{ color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 6 }}>
            ¿Te hicieron retenciones?
          </h2>

          {/* Explicación en lenguaje simple */}
          <div style={{
            background: C.surface, borderRadius: 12, padding: "16px 18px",
            marginBottom: 24, border: `1px solid ${C.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Icon name="info" color={C.blue} size={18} />
              <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.7 }}>
                <strong style={{ color: C.text }}>¿Qué son las retenciones?</strong> Son valores que tu empleador o tus clientes ya <strong>descontaron y pagaron al SRI</strong> por ti. Esto reduce directamente lo que debes pagar.
              </p>
            </div>
          </div>

          {/* Guía según tipo */}
          {esDependencia && (
            <div style={{
              background: C.yellow + "18", border: `1px solid ${C.yellow}50`,
              borderRadius: 12, padding: "14px 16px", marginBottom: 20,
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <Icon name="description" color="#D4A017" size={18} />
              <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6 }}>
                <strong style={{ color: C.text }}>Trabajas en relación de dependencia.</strong> Busca el <strong>comprobante de retención anual</strong> que te entrega tu empresa en enero. Ahí dice exactamente cuánto te retuvieron durante el año.
              </p>
            </div>
          )}

          {!esDependencia && (
            <div style={{
              background: C.blue + "10", border: `1px solid ${C.blue}25`,
              borderRadius: 12, padding: "14px 16px", marginBottom: 20,
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <Icon name="description" color={C.blue} size={18} />
              <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6 }}>
                Revisa los <strong>comprobantes de retención</strong> que te dieron tus clientes al pagarte. Suma todos los valores de "Impuesto retenido" del año {anio}.
              </p>
            </div>
          )}

          {/* Campos */}
          <div style={{ background: C.surface, borderRadius: 14, padding: 20, marginBottom: 16, border: `1px solid ${C.border}` }}>
            <CampoNumerico
              label={`Total de retenciones que te hicieron en ${anio}`}
              value={retenciones}
              onChange={setRetenciones}
              hint="Suma todos los valores de retención de tus comprobantes del año."
            />
            <div style={{ position: "relative" }}>
              <CampoNumerico
                label="Anticipos pagados (si realizaste pagos anticipados de IR)"
                value={anticipos}
                onChange={setAnticipos}
                hint="Opcional. Solo si pagaste anticipos de IR al SRI durante el año. Si no sabes qué es esto, deja $0."
              />
            </div>
          </div>

          {retenciones > 0 && (
            <div style={{
              background: C.greenAccent + "10", borderRadius: 14, padding: "16px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              border: `1px solid ${C.greenAccent}30`,
            }}>
              <span style={{ color: C.textMid, fontSize: 14, fontWeight: 600 }}>Total a tu favor</span>
              <span style={{ color: C.greenAccent, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
                {fmtDinero(retenciones + anticipos)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── PASO: RESUMEN ── */}
      {pasoId === "resumen" && (
        <div>
          <h2 style={{ color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 6 }}>
            Tu resumen de IR {anio}
          </h2>
          <p style={{ color: C.textMid, fontSize: 13, marginBottom: 24 }}>
            Así queda tu declaración. Revisa los números y descarga el archivo para presentar.
          </p>

          {/* Desglose en lenguaje simple */}
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 16, padding: "20px 24px", marginBottom: 20,
          }}>
            {esDependencia && ingDepTotal > 0 && (
              <FilaResumen label="Sueldo y otros pagos de tu empleador" value={ingDepTotal} indent />
            )}
            {tieneFacturacion && totalVentas > 0 && (
              <FilaResumen label="Total de tus facturas emitidas" value={totalVentas} indent />
            )}
            {ingresosOtros > 0 && (
              <FilaResumen label="Otros ingresos" value={ingresosOtros} indent />
            )}
            <FilaResumen label="Tus ingresos del año" value={totalIngresos} bold />

            {!esRimpe && (
              <>
                {totalGastosNegocio > 0 && (
                  <FilaResumen label="Menos gastos de tu negocio" value={totalGastosNegocio} isNegative indent />
                )}
                {totalGP > 0 && (
                  <FilaResumen label="Menos gastos personales (AGP)" value={totalGP} isNegative indent />
                )}
                <FilaResumen label="Base sobre la que calculas" value={baseImponible} bold />
              </>
            )}

            {esRimpe && (
              <FilaResumen label="Base imponible (ingresos brutos)" value={totalIngresos} bold />
            )}

            <FilaResumen
              label={esRimpe ? "Cuota IR RIMPE según tabla" : "Impuesto según tabla SRI"}
              value={irCausado}
              bold
              highlight={C.orange}
            />

            {retenciones > 0 && (
              <FilaResumen label="Menos retenciones recibidas" value={retenciones} isNegative indent />
            )}
            {anticipos > 0 && (
              <FilaResumen label="Menos anticipos pagados" value={anticipos} isNegative indent />
            )}
          </div>

          {/* Resultado destacado */}
          <div style={{
            background: irAPagar > 0 ? C.green : C.greenAccent,
            borderRadius: 16, padding: "24px",
            marginBottom: 20, textAlign: "center",
          }}>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              {irAPagar > 0 ? "Debes pagar" : irAPagar < 0 ? "El SRI te devuelve" : "No tienes impuesto a pagar"}
            </p>
            <p style={{
              color: "#fff", fontSize: 40, fontWeight: 800,
              fontFamily: "Syne, sans-serif", marginBottom: 4,
            }}>
              {fmtDinero(Math.abs(irAPagar))}
            </p>
            {irAPagar === 0 && irCausado === 0 && (
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                Estás por debajo de la fracción básica exenta
              </p>
            )}
            {irAPagar < 0 && (
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
                Tienes un saldo a favor — solicita la devolución al SRI
              </p>
            )}
          </div>

          {/* Botones de acción */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            <button onClick={() => setModal("casillas")} style={{
              padding: "14px", borderRadius: 12,
              background: "none", border: `2px solid ${C.green}`,
              color: C.green, fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: "DM Sans, sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <Icon name="table_chart" color={C.green} size={18} />
              Ver campos del Formulario 102
            </button>

            <button onClick={handleDescargarXML} style={{
              padding: "14px", borderRadius: 12,
              background: C.green, border: "none",
              color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: "DM Sans, sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <Icon name="download" color="#fff" size={18} />
              Descargar para importar al SRI
            </button>

            {estadoDeclaracion !== "presentada" ? (
              <button onClick={() => setModal("presentada")} style={{
                padding: "14px", borderRadius: 12,
                background: C.greenAccent, border: "none",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <Icon name="check_circle" color="#fff" size={18} />
                Marcar como presentada
              </button>
            ) : (
              <div style={{
                padding: "14px", borderRadius: 12, textAlign: "center",
                background: C.greenAccent + "15", border: `1px solid ${C.greenAccent}40`,
                color: C.greenAccent, fontSize: 14, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <Icon name="check_circle" color={C.greenAccent} size={18} />
                Declaración presentada
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <p style={{ color: C.textDim, fontSize: 11, lineHeight: 1.6, textAlign: "center" }}>
            Estimación basada en las tablas IR {new Date().getFullYear()} del SRI Ecuador.<br />
            Verifica los valores con un contador autorizado antes de presentar.
          </p>
        </div>
      )}

      {/* ── Botones de navegación ── */}
      <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
        {pasoActual > 0 && (
          <button onClick={retroceder} style={{
            flex: 1, padding: "14px", borderRadius: 12,
            background: "none", border: `2px solid ${C.border}`,
            color: C.textMid, fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "DM Sans, sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Icon name="arrow_back" color={C.textMid} size={16} /> Anterior
          </button>
        )}

        {pasoId !== "resumen" && (
          <button onClick={avanzar} disabled={guardando} style={{
            flex: 1, padding: "14px", borderRadius: 12,
            background: guardando ? C.border : C.green, border: "none",
            color: guardando ? C.textDim : "#fff", fontSize: 14, fontWeight: 700,
            cursor: guardando ? "not-allowed" : "pointer",
            fontFamily: "DM Sans, sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {guardando ? "Guardando..." : <>Siguiente <Icon name="arrow_forward" color="#fff" size={16} /></>}
          </button>
        )}
      </div>

      {/* ── MODAL: Campos Formulario 102 ── */}
      <ModalBase isOpen={modal === "casillas"} onClose={() => setModal(null)} title="Campos del Formulario 102">
        <p style={{ color: C.textMid, fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
          Estos son los valores de tu declaración mapeados a los casilleros del Formulario 102 del SRI.
        </p>
        {[
          { cas: "301", label: "Ingresos en relación de dependencia", value: ingDepTotal },
          { cas: "302", label: "Ingresos por facturación (ventas)", value: totalVentas },
          { cas: "303", label: "Otros ingresos", value: ingresosOtros },
          { cas: "399", label: "Total ingresos", value: totalIngresos, bold: true },
          null,
          { cas: "401", label: "Gastos deducibles del negocio", value: totalGastosNegocio },
          { cas: "451", label: "Gastos personales — Salud", value: gpSalud },
          { cas: "452", label: "Gastos personales — Educación", value: gpEducacion },
          { cas: "453", label: "Gastos personales — Alimentación", value: gpAlimentacion },
          { cas: "454", label: "Gastos personales — Vivienda", value: gpVivienda },
          { cas: "455", label: "Gastos personales — Vestimenta", value: gpVestimenta },
          { cas: "499", label: "Total deducciones", value: totalGastosNegocio + totalGP, bold: true },
          null,
          { cas: "839", label: "Base imponible", value: baseImponible, bold: true },
          { cas: "849", label: "Impuesto a la renta causado", value: irCausado, bold: true },
          { cas: "879", label: "Retenciones recibidas", value: retenciones },
          { cas: "882", label: "Anticipos pagados", value: anticipos },
          { cas: "899", label: "Impuesto a pagar / (crédito a favor)", value: irAPagar, bold: true },
        ].map((row, i) => row === null ? (
          <div key={i} style={{ height: 1, background: C.border, margin: "8px 0" }} />
        ) : (
          <div key={row.cas} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 0", borderBottom: `1px solid ${C.surface}`,
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{
                background: C.surface, color: C.green, fontSize: 10, fontWeight: 800,
                padding: "2px 8px", borderRadius: 6, fontFamily: "DM Sans, sans-serif",
                minWidth: 32, textAlign: "center",
              }}>
                {row.cas}
              </span>
              <span style={{ color: row.bold ? C.text : C.textMid, fontSize: 12, fontWeight: row.bold ? 700 : 400 }}>
                {row.label}
              </span>
            </div>
            <span style={{ color: row.bold ? C.text : C.textMid, fontSize: 13, fontWeight: row.bold ? 800 : 600 }}>
              {fmtDinero(row.value)}
            </span>
          </div>
        ))}
      </ModalBase>

      {/* ── MODAL: Instrucciones descarga ── */}
      <ModalBase isOpen={modal === "instrucciones"} onClose={() => setModal(null)} title="¿Cómo importar al SRI?">
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: C.greenAccent + "15", borderRadius: 12, marginBottom: 20, border: `1px solid ${C.greenAccent}30` }}>
          <Icon name="download_done" color={C.greenAccent} size={22} />
          <div>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Archivo descargado</p>
            <p style={{ color: C.textDim, fontSize: 12 }}>IR_{perfil?.cedula || "SRI"}_{anio}.xml</p>
          </div>
        </div>

        <p style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Pasos para presentar con el DIMM:</p>
        {[
          "Descarga e instala el software DIMM Formularios desde sri.gob.ec (Servicios en Línea → DIMM Formularios).",
          "Abre el programa y selecciona Formulario 102 — Personas Naturales.",
          'Ve a Archivo → Importar y selecciona el archivo IR_*_' + anio + '.xml que acabas de descargar.',
          "Revisa que los datos estén correctos. Puedes ajustar manualmente si es necesario.",
          "Presenta la declaración desde el mismo software DIMM.",
        ].map((paso, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", background: C.green,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 1,
            }}>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
            </div>
            <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6 }}>{paso}</p>
          </div>
        ))}

        <div style={{
          background: C.surface, borderRadius: 10, padding: "12px 14px",
          display: "flex", alignItems: "center", gap: 8, marginTop: 8,
        }}>
          <Icon name="link" color={C.green} size={16} />
          <p style={{ color: C.textMid, fontSize: 12 }}>
            Descarga el DIMM en: <strong style={{ color: C.green }}>sri.gob.ec → Servicios en Línea → DIMM</strong>
          </p>
        </div>
      </ModalBase>

      {/* ── MODAL: Marcar como presentada ── */}
      <ModalBase isOpen={modal === "presentada"} onClose={() => setModal(null)} title="Marcar como presentada">
        <p style={{ color: C.textMid, fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
          ¿Ya presentaste tu declaración de IR {anio} ante el SRI? Ingresa la fecha para registrarla en facilito.
        </p>
        <div style={{ marginBottom: 20 }}>
          <label style={{ color: C.textMid, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>
            Fecha de presentación
          </label>
          <input
            type="date"
            value={fechaPresentacion}
            onChange={e => setFechaPresentacion(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              border: `1.5px solid ${C.border}`, fontSize: 14,
              color: C.text, fontFamily: "DM Sans, sans-serif",
              background: C.surface, boxSizing: "border-box",
            }}
          />
        </div>
        <button
          onClick={marcarPresentada}
          disabled={!fechaPresentacion || marcandoPresentada}
          style={{
            width: "100%", padding: "14px", borderRadius: 12,
            background: fechaPresentacion && !marcandoPresentada ? C.greenAccent : C.border,
            border: "none", color: fechaPresentacion ? "#fff" : C.textDim,
            fontSize: 14, fontWeight: 700, cursor: fechaPresentacion ? "pointer" : "not-allowed",
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          {marcandoPresentada ? "Guardando..." : "Confirmar"}
        </button>
      </ModalBase>
    </div>
  );
}
