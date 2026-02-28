import { useNavigate } from "react-router-dom";
import { C } from "../theme";
import Icon from "./Icon";

const estadoConfig = {
  vencida: {
    borderColor: C.red,
    bgColor: C.red + "08",
    iconName: "error",
    iconColor: C.red,
    label: "Vencida",
    labelColor: C.red,
    cta: "Presentar ahora",
    ctaBg: C.red,
  },
  urgente: {
    borderColor: C.yellow,
    bgColor: C.yellow + "15",
    iconName: "schedule",
    iconColor: "#D4A017",
    label: "Urgente",
    labelColor: "#D4A017",
    cta: "Revisar ahora",
    ctaBg: C.green,
  },
  pendiente: {
    borderColor: C.border,
    bgColor: C.white,
    iconName: "pending",
    iconColor: C.textMid,
    label: "Pendiente",
    labelColor: C.textMid,
    cta: "Ver detalles",
    ctaBg: C.green,
  },
  futura: {
    borderColor: C.border,
    bgColor: C.surface,
    iconName: "event",
    iconColor: C.textDim,
    label: "Futura",
    labelColor: C.textDim,
    cta: null,
    ctaBg: null,
  },
  presentada: {
    borderColor: C.greenAccent + "60",
    bgColor: C.greenAccent + "08",
    iconName: "check_circle",
    iconColor: C.greenAccent,
    label: "Presentada",
    labelColor: C.greenAccent,
    cta: "Ver detalle",
    ctaBg: C.greenAccent,
  },
};

export default function ObligacionCard({ obligacion, compact }) {
  const navigate = useNavigate();
  const config = estadoConfig[obligacion.estado] || estadoConfig.pendiente;
  const fechaStr = obligacion.fechaVencimiento.toLocaleDateString("es-EC", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div
      onClick={() => navigate(obligacion.ruta)}
      style={{
        background: config.bgColor,
        border: `1.5px solid ${config.borderColor}`,
        borderRadius: 14,
        padding: compact ? "12px 16px" : "16px 20px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: config.iconColor + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={config.iconName} color={config.iconColor} size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{obligacion.nombre}</p>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
              background: config.iconColor + "15", color: config.labelColor,
            }}>
              {config.label}
            </span>
          </div>
          <p style={{ color: C.textMid, fontSize: 12, marginBottom: 4 }}>{obligacion.descripcion}</p>
          <p style={{ color: C.textDim, fontSize: 11 }}>
            {obligacion.estado === "vencida"
              ? `Venció el ${fechaStr} · ${Math.abs(obligacion.diasRestantes)} días de mora`
              : obligacion.estado === "presentada"
              ? `Presentada`
              : `Vence el ${fechaStr} · ${obligacion.diasRestantes} días`}
          </p>
          {obligacion.estado === "vencida" && obligacion.multaEstimada > 0 && (
            <p style={{ color: C.red, fontSize: 11, fontWeight: 600, marginTop: 4 }}>
              Multa estimada: ${obligacion.multaEstimada.toFixed(2)}
            </p>
          )}
        </div>
        {!compact && config.cta && (
          <div style={{ flexShrink: 0, alignSelf: "center", display: "flex", alignItems: "center", gap: 6 }}>
            {obligacion.ctaLabel && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
                background: config.iconColor + "15", color: config.iconColor,
                maxWidth: 180, textAlign: "right", lineHeight: 1.3,
              }}>
                {obligacion.ctaLabel}
              </span>
            )}
            <Icon name="chevron_right" color={C.textDim} size={20} />
          </div>
        )}
      </div>
      {!compact && obligacion.estado === "vencida" && (
        <p style={{ color: C.red, fontSize: 11, fontWeight: 600, marginTop: 10, paddingLeft: 52 }}>
          No acumules más mora — presenta ahora
        </p>
      )}
    </div>
  );
}
