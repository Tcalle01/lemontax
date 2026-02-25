import { C } from "../theme";
import Icon from "../components/Icon";

export default function HistorialPage() {
  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
      <div style={{ width: 64, height: 64, borderRadius: 20, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
        <Icon name="history" color={C.textDim} size={32} />
      </div>
      <h2 style={{ color: C.text, fontSize: 20, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 8 }}>Historial</h2>
      <p style={{ color: C.textMid, fontSize: 14, textAlign: "center", maxWidth: 320, lineHeight: 1.7 }}>
        Próximamente — Historial de declaraciones y documentos presentados al SRI.
      </p>
    </div>
  );
}
