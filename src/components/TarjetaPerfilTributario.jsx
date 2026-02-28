import { useNavigate } from "react-router-dom";
import { C, OBLIGACIONES_POR_TIPO } from "../theme";
import Icon from "./Icon";
import { usePerfil } from "../hooks/usePerfil";

export default function TarjetaPerfilTributario() {
  const { tipoContribuyente, descripcion, detalle, regimen } = usePerfil();
  const navigate = useNavigate();

  if (!tipoContribuyente) return null;

  const regimenLabel = regimen === "rimpe_emprendedor" ? "RIMPE Emprendedor"
    : regimen === "rimpe_negocio_popular" ? "RIMPE Negocio Popular"
    : "Régimen General";

  const obligTipos = OBLIGACIONES_POR_TIPO[tipoContribuyente] ?? [];
  const ivaLabel = obligTipos.includes("iva_semestral") ? "IVA Semestral"
    : obligTipos.includes("iva_mensual") ? "IVA Mensual"
    : null;

  return (
    <div style={{
      background: C.cardDark, borderRadius: 16, padding: "20px 24px",
      marginBottom: 20, color: C.white,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Icon name="person" color={C.yellow} size={18} />
            <span style={{ fontSize: 10, fontWeight: 700, background: C.yellow + "25", color: C.yellow, padding: "2px 8px", borderRadius: 6 }}>
              {regimenLabel}
            </span>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, fontFamily: "Syne, sans-serif", marginBottom: 4 }}>
            {descripcion}
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.5 }}>
            {detalle}
          </p>
          {ivaLabel && (
            <div style={{ marginTop: 12 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)",
                fontFamily: "DM Sans, sans-serif",
              }}>
                {ivaLabel}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => navigate("/ajustes")}
          style={{
            background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8,
            padding: "6px 12px", color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600,
            cursor: "pointer", fontFamily: "DM Sans, sans-serif",
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <Icon name="edit" color="rgba(255,255,255,0.6)" size={14} /> Editar
        </button>
      </div>
    </div>
  );
}
