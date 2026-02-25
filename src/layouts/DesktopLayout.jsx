import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { C } from "../theme";
import Icon from "../components/Icon";
import { useAuth } from "../auth";

const NAV_ITEMS = [
  { path: "/", icon: "home", label: "Inicio" },
  { path: "/obligaciones", icon: "assignment", label: "Mis Obligaciones" },
  { path: "/facturas", icon: "receipt_long", label: "Mis Facturas" },
  { path: "/historial", icon: "trending_up", label: "Historial" },
  { path: "/ajustes", icon: "settings", label: "Ajustes" },
];

export default function DesktopLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario";
  const userAvatar = user?.user_metadata?.avatar_url;
  const initiales = userName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, fontFamily: "'DM Sans', sans-serif", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        input { caret-color: ${C.greenAccent}; } input::placeholder { color: ${C.textDim}; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        button:hover { opacity: 0.88; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Sidebar — dark green */}
      <div style={{ width: 220, background: C.green, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "28px 24px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="30" height="30" viewBox="0 0 56 56" fill="none" style={{ flexShrink: 0 }}>
              <rect width="56" height="56" rx="14" fill="#F5E642"/>
              <path d="M14 28.5L23.5 38L42 19" stroke="#1A3A2A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <p style={{ color: C.yellow, fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>facilito</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>tus impuestos, facilito</p>
            </div>
          </div>
        </div>
        <nav style={{ padding: "8px 12px", flex: 1 }}>
          {NAV_ITEMS.map(item => {
            const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
            return (
              <button key={item.path} onClick={() => navigate(item.path)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 10, border: "none", cursor: "pointer",
                background: active ? C.greenMid : "transparent", marginBottom: 4,
                transition: "all 0.15s", textAlign: "left",
                borderLeft: active ? `3px solid ${C.yellow}` : "3px solid transparent",
              }}>
                <Icon name={item.icon} color={active ? C.yellow : "rgba(255,255,255,0.4)"} size={18} />
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.white : "rgba(255,255,255,0.5)", fontFamily: "DM Sans, sans-serif" }}>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {userAvatar
              ? <img src={userAvatar} style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover" }} alt="avatar" />
              : <div style={{ width: 34, height: 34, borderRadius: 10, background: C.yellow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: C.green, fontFamily: "Syne, sans-serif" }}>{initiales}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: C.white, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</p>
            </div>
          </div>
          <button onClick={logout} style={{
            width: "100%", padding: "8px", background: "transparent",
            color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "DM Sans, sans-serif",
          }}>Cerrar sesión</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <p style={{ color: C.textDim, fontSize: 12 }}>{new Date().toLocaleDateString("es-EC", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: C.greenAccent }} />
            <span style={{ color: C.textMid, fontSize: 12 }}>Todo bien</span>
          </div>
        </div>
        {/* Page content */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
