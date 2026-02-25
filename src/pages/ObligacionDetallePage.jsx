import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C, OBLIGACIONES_POR_TIPO } from "../theme";
import Icon from "../components/Icon";
import { usePerfil } from "../hooks/usePerfil";
import { useObligaciones } from "../hooks/useObligaciones";

// URL tipo → obligation type keys allowed
const TIPO_URL_A_OBLIGACION = {
  "iva": ["iva_mensual"],
  "iva-semestral": ["iva_semestral"],
  "renta": ["ir_anual", "ir_anual_rimpe"],
  "gastos-personales": ["agp"],
};

const TIPO_INFO = {
  "iva": {
    icon: "receipt",
    titulo: "Declaración de IVA Mensual",
    descripcion: "El Impuesto al Valor Agregado mensual debe declararse en el formulario 104 del portal SRI en línea.",
    instrucciones: [
      "Ingresa al portal SRI en línea con tu cédula y contraseña.",
      'Selecciona "Mis Declaraciones" → "Formulario 104 - IVA".',
      "Selecciona el período mensual correspondiente.",
      "Ingresa las ventas, compras y retenciones del mes.",
      "Firma y envía. Descarga el comprobante.",
    ],
    link: { label: "Abrir portal SRI →", url: "https://srienlinea.sri.gob.ec" },
  },
  "iva-semestral": {
    icon: "receipt",
    titulo: "Declaración de IVA Semestral",
    descripcion: "El IVA semestral aplica para contribuyentes RIMPE Emprendedor. Se declara en el formulario 104A.",
    instrucciones: [
      "Ingresa al portal SRI en línea.",
      'Selecciona "Formulario 104A - IVA Semestral RIMPE".',
      "Selecciona el semestre correspondiente (S1: ene-jun, S2: jul-dic).",
      "Ingresa los valores acumulados del semestre.",
      "Firma y envía.",
    ],
    link: { label: "Abrir portal SRI →", url: "https://srienlinea.sri.gob.ec" },
  },
  "renta": {
    icon: "account_balance",
    titulo: "Impuesto a la Renta Anual",
    descripcion: "La declaración anual de Impuesto a la Renta consolida todos tus ingresos y gastos del año fiscal.",
    instrucciones: [
      "Ingresa al portal SRI en línea.",
      'Selecciona "Mis Declaraciones" → "Formulario 102 o 102A".',
      "Selecciona el período fiscal (año anterior).",
      "Ingresa tus ingresos, gastos personales y cargas familiares.",
      "Revisa la rebaja calculada. Firma y envía.",
    ],
    link: { label: "Abrir portal SRI →", url: "https://srienlinea.sri.gob.ec" },
  },
  "gastos-personales": {
    icon: "savings",
    titulo: "Gastos Personales (AGP)",
    descripcion: "El Anexo de Gastos Personales proyectados que tu empleador necesita para calcular la retención mensual de IR.",
    instrucciones: [
      "Descarga tu Formulario GP desde Ajustes — incluye tus gastos proyectados anuales.",
      "Entrega el formulario a tu empleador antes del vencimiento.",
      "También debes presentar el Anexo GSP en el portal SRI si tus gastos superan el 50% del salario básico.",
      "Ingresa al portal SRI, busca el Formulario GP y sube el archivo.",
    ],
    link: { label: "Ir a Ajustes → Declaración", interna: "/ajustes" },
  },
};

function EstadoBadge({ estado }) {
  const configs = {
    vencida: { bg: C.red + "15", color: C.red, label: "Vencida", icon: "error" },
    urgente: { bg: C.yellow + "25", color: "#D4A017", label: "Urgente", icon: "schedule" },
    pendiente: { bg: C.border, color: C.textMid, label: "Pendiente", icon: "pending" },
    futura: { bg: C.surface, color: C.textDim, label: "Futura", icon: "event" },
    presentada: { bg: C.greenAccent + "15", color: C.greenAccent, label: "Presentada", icon: "check_circle" },
  };
  const cfg = configs[estado] || configs.pendiente;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8 }}>
      <Icon name={cfg.icon} color={cfg.color} size={14} /> {cfg.label}
    </span>
  );
}

export default function ObligacionDetallePage() {
  const { tipo, year, periodo } = useParams();
  const navigate = useNavigate();
  const { tipoContribuyente, loading: perfilLoading } = usePerfil();
  const { obligaciones, loading: obligLoading } = useObligaciones();

  // Redirect to /obligaciones if no profile
  useEffect(() => {
    if (!perfilLoading && !tipoContribuyente) navigate("/obligaciones");
  }, [perfilLoading, tipoContribuyente, navigate]);

  // Derive access error from data (no setState needed)
  const tiposPermitidos = tipoContribuyente ? (OBLIGACIONES_POR_TIPO[tipoContribuyente] || []) : null;
  const obligacionesURL = TIPO_URL_A_OBLIGACION[tipo] || [];
  const errorAcceso = tiposPermitidos !== null && !obligacionesURL.some(o => tiposPermitidos.includes(o));

  if (perfilLoading || obligLoading) return (
    <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: C.textDim, fontSize: 13 }}>Cargando...</p>
    </div>
  );

  if (errorAcceso) return (
    <div style={{ padding: 32 }}>
      <button onClick={() => navigate("/obligaciones")} style={{ display: "flex", alignItems: "center", gap: 6, color: C.textMid, fontSize: 13, background: "none", border: "none", cursor: "pointer", marginBottom: 24, fontFamily: "DM Sans, sans-serif", padding: 0 }}>
        <Icon name="arrow_back" color={C.textMid} size={16} /> Mis Obligaciones
      </button>
      <div style={{ background: C.red + "08", border: `1.5px solid ${C.red}`, borderRadius: 16, padding: "28px 32px", maxWidth: 520 }}>
        <Icon name="block" color={C.red} size={36} />
        <h2 style={{ color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif", marginTop: 16, marginBottom: 8 }}>
          Esta obligación no corresponde a tu tipo de contribuyente
        </h2>
        <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          La obligación que intentas ver no aplica para tu perfil tributario. Accede solo desde Mis Obligaciones para ver las que sí te corresponden.
        </p>
        <button onClick={() => navigate("/obligaciones")} style={{ padding: "12px 24px", background: C.green, color: C.white, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
          Ver mis obligaciones
        </button>
      </div>
    </div>
  );

  // Find matching obligation from useObligaciones
  const obligacionActual = obligaciones.find(o => {
    const urlPath = o.ruta; // e.g. /obligaciones/iva/2025/02
    return urlPath === `/obligaciones/${tipo}/${year}${periodo ? `/${periodo}` : ""}`;
  });

  const info = TIPO_INFO[tipo];
  if (!info) return (
    <div style={{ padding: 32 }}>
      <button onClick={() => navigate("/obligaciones")} style={{ color: C.textMid, fontSize: 13, background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6, padding: 0, marginBottom: 24 }}>
        <Icon name="arrow_back" color={C.textMid} size={16} /> Mis Obligaciones
      </button>
      <p style={{ color: C.textDim, fontSize: 13 }}>Obligación no reconocida.</p>
    </div>
  );

  return (
    <div style={{ padding: 32, overflowY: "auto", maxWidth: 720 }}>
      {/* Back */}
      <button onClick={() => navigate("/obligaciones")} style={{
        display: "flex", alignItems: "center", gap: 6, color: C.textMid, fontSize: 13,
        background: "none", border: "none", cursor: "pointer", fontFamily: "DM Sans, sans-serif",
        padding: 0, marginBottom: 24,
      }}>
        <Icon name="arrow_back" color={C.textMid} size={16} /> Mis Obligaciones
      </button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: C.cardDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={info.icon} color={C.yellow} size={26} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 style={{ color: C.text, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{info.titulo}</h1>
            {obligacionActual && <EstadoBadge estado={obligacionActual.estado} />}
          </div>
          {obligacionActual ? (
            <p style={{ color: C.textMid, fontSize: 13 }}>
              {obligacionActual.descripcion} ·{" "}
              {obligacionActual.estado === "vencida"
                ? `Venció el ${obligacionActual.fechaVencimiento.toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })} · ${Math.abs(obligacionActual.diasRestantes)} días de mora`
                : `Vence el ${obligacionActual.fechaVencimiento.toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })} · ${obligacionActual.diasRestantes} días`}
            </p>
          ) : (
            <p style={{ color: C.textMid, fontSize: 13 }}>Período: {year}{periodo ? ` / ${periodo}` : ""}</p>
          )}
        </div>
      </div>

      {/* Description */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "18px 20px", marginBottom: 24 }}>
        <p style={{ color: C.text, fontSize: 13, lineHeight: 1.7 }}>{info.descripcion}</p>
      </div>

      {/* Steps */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="checklist" color={C.greenAccent} size={20} /> Cómo presentar esta obligación
        </p>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {info.instrucciones.map((paso, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: i < info.instrucciones.length - 1 ? 16 : 0 }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: C.white, flexShrink: 0 }}>{i + 1}</div>
              <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, paddingTop: 4 }}>{paso}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      {info.link && (
        info.link.interna ? (
          <button onClick={() => navigate(info.link.interna)} style={{
            padding: "13px 28px", background: C.green, color: C.white, border: "none",
            borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer",
            fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon name="arrow_forward" color={C.white} size={18} /> {info.link.label}
          </button>
        ) : (
          <a href={info.link.url} target="_blank" rel="noopener noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px",
            background: C.green, color: C.white, borderRadius: 12,
            fontSize: 14, fontWeight: 700, textDecoration: "none",
          }}>
            <Icon name="open_in_new" color={C.white} size={18} /> {info.link.label}
          </a>
        )
      )}

      {/* Mora warning */}
      {obligacionActual?.estado === "vencida" && (
        <div style={{ marginTop: 20, background: C.red + "08", border: `1.5px solid ${C.red}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="warning" color={C.red} size={22} />
          <div>
            <p style={{ color: C.red, fontSize: 13, fontWeight: 700 }}>Presenta esta declaración ahora — cada día acumula más mora</p>
            <p style={{ color: C.textMid, fontSize: 12, marginTop: 4 }}>La multa aumenta con el tiempo. Hazlo hoy para detener el cargo.</p>
          </div>
        </div>
      )}
    </div>
  );
}
