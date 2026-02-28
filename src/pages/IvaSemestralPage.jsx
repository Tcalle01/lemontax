import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { C, DIAS_VENCIMIENTO, OBLIGACIONES_POR_TIPO } from "../theme";
import Icon from "../components/Icon";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { usePerfil } from "../hooks/usePerfil";

const IVA_RATE = 0.15;

const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fmtNum(n) {
  return (n || 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcFechaVenc(anio, sem, digito) {
  const dia = DIAS_VENCIMIENTO[String(digito)] ?? 28;
  // S1 (ene–jun) vence en julio del mismo año; S2 (jul–dic) vence en enero del año siguiente
  const mesVenc = sem === 1 ? 7 : 1;
  const anioVenc = sem === 1 ? parseInt(anio) : parseInt(anio) + 1;
  const lastDay = new Date(anioVenc, mesVenc, 0).getDate();
  return new Date(anioVenc, mesVenc - 1, Math.min(dia, lastDay));
}

function calcEstado(fv, presentada) {
  if (presentada) return { estado: "presentada", dias: 0 };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = Math.floor((fv.getTime() - hoy.getTime()) / 86400000);
  if (d < 0) return { estado: "vencida", dias: d };
  if (d <= 7) return { estado: "urgente", dias: d };
  if (d <= 30) return { estado: "pendiente", dias: d };
  return { estado: "futura", dias: d };
}

// ─── Badge de estado ───────────────────────────────────────────────────────────
function Badge({ estado }) {
  const map = {
    presentada: { bg: "#4CAF8218", c: "#4CAF82", label: "Presentada", icon: "check_circle" },
    vencida:    { bg: "#E0525218", c: "#E05252", label: "Vencida",    icon: "error" },
    urgente:    { bg: "#F5E64228", c: "#9A7000", label: "Urgente",    icon: "schedule" },
    pendiente:  { bg: "#E0E8E2",   c: "#5A7A64", label: "Pendiente",  icon: "pending" },
    futura:     { bg: "#F7FAF8",   c: "#8FA894", label: "Futura",     icon: "event" },
  };
  const s = map[estado] ?? map.pendiente;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.c,
      fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
      fontFamily: "DM Sans, sans-serif",
    }}>
      <Icon name={s.icon} color={s.c} size={13} />
      {s.label}
    </span>
  );
}

// ─── Tarjeta de sección ────────────────────────────────────────────────────────
function Card({ icon, title, color, children }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: "20px 22px", marginBottom: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      <p style={{
        color: C.text, fontSize: 14, fontWeight: 700,
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 14, fontFamily: "DM Sans, sans-serif",
      }}>
        <Icon name={icon} color={color || C.greenAccent} size={18} />
        {title}
      </p>
      {children}
    </div>
  );
}

// ─── Fila simple ──────────────────────────────────────────────────────────────
function Fila({ label, valor, bold, indent, nota }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "8px 0", borderBottom: `1px solid ${C.border}`,
    }}>
      <span style={{
        color: bold ? C.text : C.textMid, fontSize: 13, fontWeight: bold ? 700 : 400,
        paddingLeft: indent ? 18 : 0, fontFamily: "DM Sans, sans-serif",
      }}>
        {label}
        {nota && <span style={{ color: C.textDim, fontSize: 11, marginLeft: 6 }}>({nota})</span>}
      </span>
      <span style={{
        color: bold ? C.text : C.textMid, fontSize: 13, fontWeight: bold ? 700 : 500,
        fontFamily: "DM Sans, sans-serif", whiteSpace: "nowrap",
      }}>
        ${fmtNum(valor)}
      </span>
    </div>
  );
}

// ─── Modal: Formulario 104-A pre-llenado ──────────────────────────────────────
function ModalForm104A({
  onClose, labelSemestre,
  totalVentasGravadas, totalVentasCero, ivaVentas,
  totalCompras, ivaCompras, saldo,
}) {
  const baseCompras = totalCompras > 0 ? totalCompras / (1 + IVA_RATE) : 0;

  const campos = [
    { num: "401", desc: "Ventas gravadas — base sin IVA (15%)",     val: totalVentasGravadas },
    { num: "421", desc: "IVA que cobraste a tus clientes",           val: ivaVentas },
    { num: "451", desc: "Ventas sin IVA (tarifa 0%)",                val: totalVentasCero },
    { num: "500", desc: "Compras — base estimada sin IVA",           val: baseCompras },
    { num: "507", desc: "IVA que pagaste en tus compras",            val: ivaCompras },
    saldo >= 0
      ? { num: "601", desc: "Total a pagar al SRI",       val: saldo,          destaca: true, esPago: true }
      : { num: "602", desc: "Tu saldo a favor del SRI",   val: Math.abs(saldo), destaca: true, esPago: false },
  ];

  const pasos = [
    "Ingresa al portal SRI en línea (srienlinea.sri.gob.ec) con tu RUC y clave de acceso.",
    `Ve a "Mis declaraciones" → "Formulario 104-A – IVA Semestral" y selecciona el período ${labelSemestre}.`,
    "En el módulo Ventas, ingresa el campo 401 (ventas gravadas base) y el campo 451 (ventas tarifa 0%).",
    "En el módulo Compras, ingresa el campo 507 (IVA que pagaste en tus compras durante el semestre).",
    "El portal calculará automáticamente si debes pagar (campo 601) o tienes saldo a favor (campo 602).",
    "Firma electrónicamente con tu token o clave de firma digital.",
    "Envía la declaración y descarga el comprobante PDF — guárdalo en tus archivos.",
  ];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.card, borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: "28px 28px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <h2 style={{ color: C.text, fontSize: 17, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 3 }}>
              Formulario 104-A pre-llenado
            </h2>
            <p style={{ color: C.textDim, fontSize: 12, fontFamily: "DM Sans, sans-serif" }}>
              {labelSemestre} — copia estos valores en el portal SRI
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <Icon name="close" color={C.textDim} size={22} />
          </button>
        </div>

        <div style={{ background: C.surface, borderRadius: 12, padding: "16px 18px", marginBottom: 22 }}>
          <p style={{ color: C.textDim, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, marginBottom: 12, fontFamily: "DM Sans, sans-serif" }}>
            VALORES A COPIAR EN EL PORTAL
          </p>
          {campos.map((c) => (
            <div key={c.num} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
                <span style={{
                  background: c.destaca ? C.green : C.border,
                  color: c.destaca ? C.white : C.textMid,
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5, flexShrink: 0,
                  fontFamily: "DM Sans, sans-serif",
                }}>
                  {c.num}
                </span>
                <span style={{ color: c.destaca ? C.text : C.textMid, fontSize: 13, fontFamily: "DM Sans, sans-serif", fontWeight: c.destaca ? 600 : 400 }}>
                  {c.desc}
                </span>
              </div>
              <span style={{
                color: c.destaca ? (c.esPago ? C.red : C.greenAccent) : C.text,
                fontSize: 13, fontWeight: 700,
                fontFamily: "DM Sans, sans-serif", whiteSpace: "nowrap", marginLeft: 12,
              }}>
                ${fmtNum(c.val)}
              </span>
            </div>
          ))}
        </div>

        <p style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 7, fontFamily: "DM Sans, sans-serif" }}>
          <Icon name="checklist" color={C.greenAccent} size={17} />
          Cómo presentarlo paso a paso
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {pasos.map((paso, i) => (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 12, background: C.green, color: C.white,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, flexShrink: 0, fontFamily: "DM Sans, sans-serif",
              }}>
                {i + 1}
              </div>
              <p style={{ color: C.textMid, fontSize: 12.5, lineHeight: 1.65, paddingTop: 3, fontFamily: "DM Sans, sans-serif" }}>
                {paso}
              </p>
            </div>
          ))}
        </div>

        <a
          href="https://srienlinea.sri.gob.ec"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", background: C.green, color: C.white, borderRadius: 11, fontSize: 14, fontWeight: 700, textDecoration: "none", fontFamily: "DM Sans, sans-serif" }}
        >
          <Icon name="open_in_new" color={C.white} size={16} />
          Ir al portal SRI
        </a>
      </div>
    </div>
  );
}

// ─── Modal: Marcar como presentada ────────────────────────────────────────────
function ModalMarcar({ onClose, onConfirm, saving }) {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: C.card, borderRadius: 20, width: "100%", maxWidth: 380, padding: "28px 28px 24px" }}>
        <h2 style={{ color: C.text, fontSize: 17, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 8 }}>
          ¿Ya la presentaste?
        </h2>
        <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 20, fontFamily: "DM Sans, sans-serif" }}>
          Ingresa la fecha en que enviaste la declaración en el portal del SRI. La guardaremos en tu historial.
        </p>

        <label style={{ display: "block", color: C.textMid, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, marginBottom: 6, fontFamily: "DM Sans, sans-serif" }}>
          FECHA DE PRESENTACIÓN
        </label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px",
            border: `1.5px solid ${C.border}`, borderRadius: 10,
            fontSize: 14, fontFamily: "DM Sans, sans-serif", color: C.text,
            outline: "none", boxSizing: "border-box", marginBottom: 22,
            background: C.bg,
          }}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "12px 0", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", color: C.textMid }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(fecha)}
            disabled={saving || !fecha}
            style={{ flex: 1, padding: "12px 0", background: C.green, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "DM Sans, sans-serif", color: C.white, opacity: saving ? 0.65 : 1 }}
          >
            {saving ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function IvaSemestralPage() {
  const { anio, semestre } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tipoContribuyente, novenoDigitoRuc, loading: perfilLoading } = usePerfil();

  const [compras, setCompras] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [declaracion, setDeclaracion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMarcarModal, setShowMarcarModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const sem = parseInt(semestre, 10); // 1 or 2
  const mesInicio = sem === 1 ? 1 : 7;
  const mesFin = sem === 1 ? 6 : 12;
  const meses = Array.from({ length: 6 }, (_, i) => mesInicio + i);
  const periodo = `${anio}-S${sem}`;
  const labelSemestre = sem === 1 ? `Enero a Junio ${anio}` : `Julio a Diciembre ${anio}`;

  // Acceso: solo rimpe_emprendedor tiene iva_semestral
  const tieneAcceso = !perfilLoading && tipoContribuyente &&
    (OBLIGACIONES_POR_TIPO[tipoContribuyente] ?? []).includes("iva_semestral");

  // Fecha de vencimiento
  const fv = (novenoDigitoRuc && anio && semestre)
    ? calcFechaVenc(anio, sem, novenoDigitoRuc)
    : null;

  // ─── Fetch datos ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || perfilLoading) return;

    async function load() {
      setLoading(true);

      const anioNum = parseInt(anio, 10);
      const mInicio = sem === 1 ? 1 : 7;
      const mFin = sem === 1 ? 6 : 12;
      const desde = `${anio}-${String(mInicio).padStart(2, "0")}-01`;
      const mesFinSig = mFin + 1 > 12 ? 1 : mFin + 1;
      const anioFinSig = mFin + 1 > 12 ? anioNum + 1 : anioNum;
      const hasta = `${anioFinSig}-${String(mesFinSig).padStart(2, "0")}-01`;
      const per = `${anio}-S${sem}`;

      const [resCompras, resVentas, resDecl] = await Promise.allSettled([
        supabase.from("facturas")
          .select("id, emisor, monto, categoria, fecha")
          .eq("user_id", user.id)
          .gte("fecha", desde)
          .lt("fecha", hasta)
          .or("es_venta.is.null,es_venta.eq.false"),

        supabase.from("facturas")
          .select("id, emisor, monto, categoria, fecha, tarifa_iva")
          .eq("user_id", user.id)
          .gte("fecha", desde)
          .lt("fecha", hasta)
          .eq("es_venta", true),

        supabase.from("declaraciones_iva")
          .select("*")
          .eq("user_id", user.id)
          .eq("periodo", per)
          .maybeSingle(),
      ]);

      setCompras(resCompras.status === "fulfilled" ? (resCompras.value.data ?? []) : []);
      setVentas(resVentas.status === "fulfilled" ? (resVentas.value.data ?? []) : []);
      setDeclaracion(resDecl.status === "fulfilled" ? (resDecl.value.data ?? null) : null);
      setLoading(false);
    }

    load();
  }, [user, perfilLoading, anio, semestre, sem]);

  // ─── Cálculos por mes (render-time, derived state) ──────────────────────────
  const dataPorMes = meses.map((m) => {
    const cItems = compras.filter(f => parseInt(f.fecha?.slice(5, 7), 10) === m);
    const vItems = ventas.filter(f => parseInt(f.fecha?.slice(5, 7), 10) === m);

    const totalC = cItems.reduce((s, f) => s + (f.monto ?? 0), 0);
    const ivaC = totalC * IVA_RATE / (1 + IVA_RATE);

    const vGrav = vItems.filter(v => v.tarifa_iva == null || v.tarifa_iva > 0);
    const vCero = vItems.filter(v => v.tarifa_iva === 0);
    const totalVG = vGrav.reduce((s, v) => s + (v.monto ?? 0), 0);
    const totalVC = vCero.reduce((s, v) => s + (v.monto ?? 0), 0);
    const ivaV = totalVG * IVA_RATE;

    return {
      mes: m,
      nombre: MESES_NOMBRES[m - 1].slice(0, 3),
      nombreCompleto: MESES_NOMBRES[m - 1],
      totalCompras: totalC,
      ivaCompras: ivaC,
      totalVentasGravadas: totalVG,
      totalVentasCero: totalVC,
      ivaVentas: ivaV,
      saldoMes: ivaV - ivaC,
    };
  });

  // ─── Totales del semestre ────────────────────────────────────────────────────
  const totalCompras = dataPorMes.reduce((s, d) => s + d.totalCompras, 0);
  const ivaCompras = dataPorMes.reduce((s, d) => s + d.ivaCompras, 0);
  const totalVentasGravadas = dataPorMes.reduce((s, d) => s + d.totalVentasGravadas, 0);
  const totalVentasCero = dataPorMes.reduce((s, d) => s + d.totalVentasCero, 0);
  const ivaVentas = dataPorMes.reduce((s, d) => s + d.ivaVentas, 0);
  const saldo = ivaVentas - ivaCompras;

  const esPresentada = declaracion?.estado === "presentada";
  const { estado, dias } = fv
    ? calcEstado(fv, esPresentada)
    : { estado: esPresentada ? "presentada" : "futura", dias: 0 };

  // ─── Guardar como presentada ─────────────────────────────────────────────────
  const marcarPresentada = useCallback(async (fechaPres) => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      periodo,
      tipo: "semestral",
      total_ventas: totalVentasGravadas + totalVentasCero,
      iva_ventas: ivaVentas,
      total_compras: totalCompras,
      credito_tributario: ivaCompras,
      valor_pagar: saldo,
      fecha_vencimiento: fv?.toISOString().slice(0, 10) ?? null,
      fecha_presentacion: fechaPres,
      estado: "presentada",
    };

    try {
      if (declaracion?.id) {
        const { data } = await supabase
          .from("declaraciones_iva")
          .update(payload)
          .eq("id", declaracion.id)
          .select()
          .single();
        if (data) setDeclaracion(data);
      } else {
        const { data } = await supabase
          .from("declaraciones_iva")
          .insert(payload)
          .select()
          .single();
        if (data) setDeclaracion(data);
      }
    } catch (e) {
      console.error("Error guardando declaracion_iva semestral:", e);
    }

    setSaving(false);
    setShowMarcarModal(false);
  }, [user, periodo, totalVentasGravadas, totalVentasCero, ivaVentas, totalCompras, ivaCompras, saldo, fv, declaracion]);

  // ─── Guards ─────────────────────────────────────────────────────────────────
  if (perfilLoading || loading) {
    return (
      <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <p style={{ color: C.textDim, fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>Cargando...</p>
      </div>
    );
  }

  if (!tieneAcceso) {
    return (
      <div style={{ padding: 32 }}>
        <button
          onClick={() => navigate("/obligaciones")}
          style={{ display: "flex", alignItems: "center", gap: 6, color: C.textMid, fontSize: 13, background: "none", border: "none", cursor: "pointer", marginBottom: 24, fontFamily: "DM Sans, sans-serif", padding: 0 }}
        >
          <Icon name="arrow_back" color={C.textMid} size={16} /> Mis Obligaciones
        </button>
        <div style={{ background: C.red + "08", border: `1.5px solid ${C.red}40`, borderRadius: 16, padding: "28px 32px", maxWidth: 520 }}>
          <Icon name="block" color={C.red} size={32} />
          <h2 style={{ color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginTop: 14, marginBottom: 8 }}>
            Esta declaración no aplica para tu perfil
          </h2>
          <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.7, fontFamily: "DM Sans, sans-serif" }}>
            La declaración semestral de IVA aplica únicamente para contribuyentes RIMPE Emprendedor.
            Tu perfil actual no requiere este trámite.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  const fechaVencFmt = fv
    ? fv.toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const fechaPresFmt = declaracion?.fecha_presentacion
    ? new Date(declaracion.fecha_presentacion + "T00:00:00").toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Datos para el gráfico de barras
  const chartData = dataPorMes.map(d => ({
    mes: d.nombre,
    Ventas: parseFloat(d.totalVentasGravadas.toFixed(2)),
    Compras: parseFloat(d.totalCompras.toFixed(2)),
  }));

  return (
    <div style={{ padding: "28px 32px", maxWidth: 760, overflowY: "auto" }}>
      {/* ── Back ── */}
      <button
        onClick={() => navigate("/obligaciones")}
        style={{ display: "flex", alignItems: "center", gap: 6, color: C.textMid, fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 24, fontFamily: "DM Sans, sans-serif" }}
      >
        <Icon name="arrow_back" color={C.textMid} size={16} />
        Mis Obligaciones
      </button>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: C.cardDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="receipt" color={C.yellow} size={26} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <h1 style={{ color: C.text, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif", margin: 0 }}>
              IVA Semestral — {labelSemestre}
            </h1>
            <Badge estado={estado} />
          </div>
          <p style={{ color: C.textMid, fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>
            {estado === "presentada" && fechaPresFmt
              ? `Presentada el ${fechaPresFmt}`
              : estado === "vencida" && fechaVencFmt
                ? `Venció el ${fechaVencFmt} · ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? "s" : ""} de mora`
                : fechaVencFmt
                  ? `Fecha límite: ${fechaVencFmt} · ${dias} día${dias !== 1 ? "s" : ""} restantes`
                  : "Configura tu noveno dígito de RUC en Ajustes para ver la fecha límite"}
          </p>
        </div>
      </div>

      {/* ── Gráfico comparativo por mes ── */}
      <Card icon="bar_chart" title="Ventas vs Compras — comparativo mensual" color={C.purple}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={18} barGap={4}>
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 11, fill: C.textMid, fontFamily: "DM Sans, sans-serif" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: C.textDim, fontFamily: "DM Sans, sans-serif" }}
              tickFormatter={(v) => `$${v}`}
              axisLine={false}
              tickLine={false}
              width={62}
            />
            <Tooltip
              contentStyle={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 10, fontFamily: "DM Sans, sans-serif", fontSize: 12,
              }}
              formatter={(v, name) => [`$${fmtNum(v)}`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: "DM Sans, sans-serif", paddingTop: 8 }} />
            <Bar dataKey="Ventas" fill={C.greenAccent} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Compras" fill={C.blue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Tabla desglosada por mes ── */}
      <Card icon="table_chart" title="Desglose por mes">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "DM Sans, sans-serif" }}>
            <thead>
              <tr>
                {["Mes", "Ventas (base)", "IVA cobrado", "Compras (total)", "IVA pagado", "Saldo mes"].map((col, i) => (
                  <th key={col} style={{
                    padding: "8px 12px",
                    textAlign: i === 0 ? "left" : "right",
                    fontSize: 11, fontWeight: 700,
                    color: C.textDim,
                    background: C.surface,
                    borderBottom: `1.5px solid ${C.border}`,
                    whiteSpace: "nowrap",
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataPorMes.map((d, i) => (
                <tr key={d.mes} style={{ background: i % 2 === 0 ? C.white : C.surface }}>
                  <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 600, color: C.text, borderBottom: `1px solid ${C.border}` }}>
                    {d.nombreCompleto}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, color: C.textMid, borderBottom: `1px solid ${C.border}` }}>
                    ${fmtNum(d.totalVentasGravadas)}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, fontWeight: 600, color: C.greenAccent, borderBottom: `1px solid ${C.border}` }}>
                    ${fmtNum(d.ivaVentas)}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, color: C.textMid, borderBottom: `1px solid ${C.border}` }}>
                    ${fmtNum(d.totalCompras)}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, fontWeight: 600, color: C.blue, borderBottom: `1px solid ${C.border}` }}>
                    ${fmtNum(d.ivaCompras)}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, borderBottom: `1px solid ${C.border}`,
                    color: d.saldoMes > 0 ? C.red : d.saldoMes < 0 ? C.greenAccent : C.textMid,
                  }}>
                    {d.saldoMes < 0 ? `+$${fmtNum(Math.abs(d.saldoMes))}` : `$${fmtNum(d.saldoMes)}`}
                  </td>
                </tr>
              ))}
              {/* Fila de totales */}
              <tr style={{ background: C.cardDark }}>
                <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 800, color: C.white, borderRadius: "0 0 0 10px" }}>
                  TOTAL SEMESTRE
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: C.white }}>
                  ${fmtNum(totalVentasGravadas)}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: C.yellow }}>
                  ${fmtNum(ivaVentas)}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: C.white }}>
                  ${fmtNum(totalCompras)}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 700, color: C.yellow }}>
                  ${fmtNum(ivaCompras)}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 13, fontWeight: 800, borderRadius: "0 0 10px 0",
                  color: saldo > 0 ? "#FF8A80" : saldo < 0 ? "#69F0AE" : "rgba(255,255,255,0.7)",
                }}>
                  {saldo < 0 ? `+$${fmtNum(Math.abs(saldo))}` : `$${fmtNum(saldo)}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Sección 1: Ventas del semestre ── */}
      <Card icon="trending_up" title="Lo que cobraste a tus clientes (semestre)">
        {totalVentasGravadas === 0 && totalVentasCero === 0 ? (
          <div style={{ textAlign: "center", padding: "14px 0 6px" }}>
            <Icon name="point_of_sale" color={C.textDim} size={30} />
            <p style={{ color: C.textDim, fontSize: 13, marginTop: 10, fontFamily: "DM Sans, sans-serif" }}>
              No hay facturas de venta en {labelSemestre}.
            </p>
            <p style={{ color: C.textDim, fontSize: 12, marginTop: 4, lineHeight: 1.5, fontFamily: "DM Sans, sans-serif" }}>
              Las ventas se registran manualmente.<br />Si ya tienes ventas, agrégalas desde la sección Facturas.
            </p>
          </div>
        ) : (
          <>
            <Fila label={`Ventas con IVA — base (${ventas.filter(v => v.tarifa_iva == null || v.tarifa_iva > 0).length} factura${ventas.filter(v => v.tarifa_iva == null || v.tarifa_iva > 0).length !== 1 ? "s" : ""})`} valor={totalVentasGravadas} />
            <Fila label="+ IVA que cobraste (15%)" valor={ivaVentas} indent nota="se le cobra al cliente" />
            {totalVentasCero > 0 && (
              <Fila label={`Ventas sin IVA — tarifa 0%`} valor={totalVentasCero} />
            )}
            <Fila label="Total cobrado a clientes" valor={totalVentasGravadas + ivaVentas + totalVentasCero} bold />
          </>
        )}
      </Card>

      {/* ── Sección 2: Compras del semestre ── */}
      <Card icon="shopping_cart" title="Lo que pagaste de IVA en tus compras (semestre)">
        {totalCompras === 0 ? (
          <div style={{ textAlign: "center", padding: "14px 0 6px" }}>
            <Icon name="receipt_long" color={C.textDim} size={30} />
            <p style={{ color: C.textDim, fontSize: 13, marginTop: 10, fontFamily: "DM Sans, sans-serif" }}>
              No hay facturas de compra en {labelSemestre}.
            </p>
            <p style={{ color: C.textDim, fontSize: 12, marginTop: 4, fontFamily: "DM Sans, sans-serif" }}>
              Sincroniza tu Gmail desde Ajustes para importar facturas automáticamente.
            </p>
          </div>
        ) : (
          <>
            <Fila label={`Total en compras (${compras.length} factura${compras.length !== 1 ? "s" : ""})`} valor={totalCompras} />
            <Fila label="IVA incluido en esas compras" valor={ivaCompras} bold nota="estimado a tarifa 15%" />
            <div style={{ marginTop: 10, background: C.surface, borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Icon name="info" color={C.textDim} size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              <p style={{ color: C.textDim, fontSize: 11.5, lineHeight: 1.55, fontFamily: "DM Sans, sans-serif" }}>
                El IVA se estima a tarifa 15% sobre el total de tus compras. Si alguna factura tiene tarifa 0%, el valor real será menor — verifica antes de presentar.
              </p>
            </div>
          </>
        )}
      </Card>

      {/* ── Resultado del semestre ── */}
      <div style={{
        background: saldo > 0 ? C.red + "08" : C.greenAccent + "12",
        border: `1.5px solid ${saldo > 0 ? C.red + "35" : C.greenAccent + "45"}`,
        borderRadius: 14, padding: "20px 22px", marginBottom: 24,
      }}>
        <p style={{ color: C.text, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontFamily: "DM Sans, sans-serif" }}>
          <Icon name="calculate" color={saldo > 0 ? C.red : C.greenAccent} size={18} />
          Tu resultado del semestre
        </p>

        <div style={{ background: C.card, borderRadius: 10, padding: "2px 14px", marginBottom: 16 }}>
          <Fila label="IVA que cobraste a tus clientes" valor={ivaVentas} />
          <Fila label="IVA que pagaste en tus compras"  valor={ivaCompras} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: saldo > 0 ? C.red + "18" : C.greenAccent + "20",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name={saldo > 0 ? "account_balance" : "savings"} color={saldo > 0 ? C.red : C.greenAccent} size={22} />
          </div>
          <div>
            {saldo > 0 ? (
              <>
                <p style={{ color: C.red, fontSize: 15, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
                  Debes pagar al SRI: ${fmtNum(saldo)}
                </p>
                <p style={{ color: C.textMid, fontSize: 12, marginTop: 3, fontFamily: "DM Sans, sans-serif" }}>
                  Es el IVA que cobraste a tus clientes y debes transferir al Estado.
                </p>
              </>
            ) : saldo < 0 ? (
              <>
                <p style={{ color: C.greenAccent, fontSize: 15, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
                  Tienes saldo a favor: ${fmtNum(Math.abs(saldo))}
                </p>
                <p style={{ color: C.textMid, fontSize: 12, marginTop: 3, fontFamily: "DM Sans, sans-serif" }}>
                  Este saldo se aplica automáticamente a tu próxima declaración semestral.
                </p>
              </>
            ) : (
              <>
                <p style={{ color: C.textMid, fontSize: 15, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
                  Resultado cero: no debes ni tienes a favor
                </p>
                <p style={{ color: C.textMid, fontSize: 12, marginTop: 3, fontFamily: "DM Sans, sans-serif" }}>
                  El IVA cobrado y pagado se compensan exactamente.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Acciones ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 20px", background: C.surface,
            border: `1.5px solid ${C.border}`, borderRadius: 11,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
            fontFamily: "DM Sans, sans-serif", color: C.text,
          }}
        >
          <Icon name="description" color={C.greenAccent} size={18} />
          Ver formulario pre-llenado
        </button>

        {estado !== "presentada" ? (
          <button
            onClick={() => setShowMarcarModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 20px", background: C.green,
              border: "none", borderRadius: 11,
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              fontFamily: "DM Sans, sans-serif", color: C.white,
            }}
          >
            <Icon name="check_circle" color={C.white} size={18} />
            Marcar como presentada
          </button>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 20px",
            background: "#4CAF8215", border: `1.5px solid #4CAF8240`,
            borderRadius: 11,
          }}>
            <Icon name="check_circle" color="#4CAF82" size={18} />
            <span style={{ color: "#4CAF82", fontSize: 14, fontWeight: 600, fontFamily: "DM Sans, sans-serif" }}>
              Declaración presentada
            </span>
          </div>
        )}
      </div>

      {/* Aviso mora */}
      {estado === "vencida" && (
        <div style={{ marginTop: 16, background: C.red + "08", border: `1.5px solid ${C.red}35`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <Icon name="warning" color={C.red} size={20} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ color: C.red, fontSize: 13, fontWeight: 700, fontFamily: "DM Sans, sans-serif" }}>
              Esta declaración está vencida — la mora aumenta cada día
            </p>
            <p style={{ color: C.textMid, fontSize: 12, marginTop: 4, fontFamily: "DM Sans, sans-serif" }}>
              Preséntala hoy en el portal SRI para detener el cargo de intereses y multas.
            </p>
          </div>
        </div>
      )}

      {/* ── Modales ── */}
      {showModal && (
        <ModalForm104A
          onClose={() => setShowModal(false)}
          labelSemestre={labelSemestre}
          totalVentasGravadas={totalVentasGravadas}
          totalVentasCero={totalVentasCero}
          ivaVentas={ivaVentas}
          totalCompras={totalCompras}
          ivaCompras={ivaCompras}
          saldo={saldo}
        />
      )}

      {showMarcarModal && (
        <ModalMarcar
          onClose={() => setShowMarcarModal(false)}
          onConfirm={marcarPresentada}
          saving={saving}
        />
      )}
    </div>
  );
}
