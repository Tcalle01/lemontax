import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { C } from "../theme";
import Icon from "../components/Icon";

const NAV_ITEMS = [
  { path: "/", icon: "home", label: "Inicio" },
  { path: "/obligaciones", icon: "assignment", label: "Obligaciones" },
  { path: "/facturas", icon: "receipt_long", label: "Facturas" },
  { path: "/historial", icon: "trending_up", label: "Historial" },
  { path: "/ajustes", icon: "settings", label: "Ajustes" },
];

export default function MobileLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#F0F4F1", fontFamily: "'DM Sans', sans-serif", padding: "20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        .tap:active { transform: scale(0.97); transition: 0.1s; }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .screen-enter { animation: slideUp 0.3s ease forwards; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .pulse { animation: pulse 2s infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: #B0BEC5; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>

      <div style={{ width: 390, height: 844, background: C.white, borderRadius: 44, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 100px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)" }}>
        {/* Status bar */}
        <div style={{ background: C.green, padding: "14px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "center", color: C.white, fontSize: 12, fontWeight: 600 }}>
          <span>9:41</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span>WiFi</span>
            <Icon name="battery_full" color={C.white} size={16} />
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
          <Outlet />
        </div>

        {/* Tab bar */}
        <div style={{ background: C.green, padding: "10px 4px 24px", display: "flex", justifyContent: "space-around" }}>
          {NAV_ITEMS.map(item => {
            const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
            return (
              <button key={item.path} onClick={() => navigate(item.path)} style={{
                background: active ? C.greenMid : "transparent", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                padding: "5px 8px", borderRadius: 10, transition: "all 0.2s",
              }}>
                <Icon name={item.icon} color={active ? C.yellow : "rgba(255,255,255,0.5)"} size={20} />
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, color: active ? C.white : "rgba(255,255,255,0.5)" }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
