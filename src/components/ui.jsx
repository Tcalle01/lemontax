import { C } from "../theme";

export function GreenBtn({ children, onClick, outline, small, disabled, style: extra }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: small ? "11px" : "15px",
      background: outline ? "transparent" : (disabled ? C.border : C.green),
      color: outline ? C.green : (disabled ? C.textDim : C.white),
      border: outline ? `2px solid ${C.green}` : "none",
      borderRadius: 14, fontSize: small ? 13 : 15, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "DM Sans, sans-serif", transition: "all 0.2s",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      ...extra,
    }}>{children}</button>
  );
}

export function SectionLabel({ children }) {
  return (
    <p style={{ color: C.green, fontSize: 11, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
      {children}
    </p>
  );
}

export function Input({ label, value, onChange, prefix, type = "text", placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ color: C.textMid, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", background: C.surface, borderRadius: 12, border: `1.5px solid ${C.border}`, overflow: "hidden" }}>
        {prefix && <span style={{ padding: "0 10px 0 14px", color: C.green, fontSize: 14, fontWeight: 700 }}>{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, padding: "12px 14px", background: "transparent", border: "none", outline: "none",
            fontSize: 14, color: C.green, fontFamily: "DM Sans, sans-serif", fontWeight: 600,
          }}
        />
      </div>
    </div>
  );
}
