import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

const COLORS = {
  green: "#1A3A2A",
  yellow: "#F5E642",
  white: "#FFFFFF",
  offWhite: "#F9F9F3",
  gray: "#8A9A8E",
  grayLight: "#EEF2EE",
  greenAccent: "#4CAF82",
};

const categoriaColors = {
  "Alimentación": "#4CAF82",
  "Salud": "#52A8E0",
  "Servicios": "#E09652",
  "Educación": "#9C52E0",
  "Entretenimiento": "#E05252",
  "Transporte": "#52C4E0",
  "Vivienda": "#E09652",
  "Vestimenta": "#F06292",
  "Turismo": "#26C6DA",
  "Otros": "#90A4AE",
};

const categoriaIcons = {
  "Alimentación": "🛒",
  "Salud": "💊",
  "Servicios": "📱",
  "Educación": "📚",
  "Entretenimiento": "🎬",
  "Transporte": "⛽",
  "Vivienda": "🏠",
  "Vestimenta": "👕",
  "Turismo": "✈️",
  "Otros": "📋",
};

// SRI categories that map to GP form fields
const CAT_SRI = {
  "Vivienda": { field: 106, color: "#E09652" },
  "Educación": { field: 107, color: "#9C52E0" },
  "Salud": { field: 108, color: "#52A8E0" },
  "Vestimenta": { field: 109, color: "#F06292" },
  "Alimentación": { field: 110, color: "#4CAF82" },
  "Turismo": { field: 111, color: "#26C6DA" },
};

const CANASTA = 821.80; // SRI 2026 value

const initialFacturas = [
  { id: 1, emisor: "Supermaxi", ruc: "1790000000001", fecha: "18 Feb", monto: 47.80, categoria: "Alimentación", sri: true, comprobantes: 2 },
  { id: 2, emisor: "Farmacia Cruz Azul", ruc: "1780000000001", fecha: "16 Feb", monto: 23.50, categoria: "Salud", sri: true, comprobantes: 1 },
  { id: 3, emisor: "Claro Ecuador", ruc: "1790000000002", fecha: "14 Feb", monto: 35.00, categoria: "Servicios", sri: true, comprobantes: 1 },
  { id: 4, emisor: "Librería Española", ruc: "1690000000001", fecha: "12 Feb", monto: 18.90, categoria: "Educación", sri: true, comprobantes: 3 },
  { id: 5, emisor: "Netflix Ecuador", ruc: "1790000000003", fecha: "10 Feb", monto: 12.99, categoria: "Entretenimiento", sri: false, comprobantes: 1 },
  { id: 6, emisor: "Shell Gasolinera", ruc: "0980000000001", fecha: "8 Feb", monto: 55.00, categoria: "Transporte", sri: true, comprobantes: 1 },
];

const CATEGORIAS = ["Alimentación", "Salud", "Servicios", "Educación", "Entretenimiento", "Transporte", "Vivienda", "Vestimenta", "Turismo", "Otros"];

// ── Helpers ─────────────────────────────────────────────────────────────────
function calcLimiteGP(salarioAnual, cargas) {
  // Tabla SRI: límite de deducción = canastas según cargas
  const canastas = [7, 9, 11, 14, 17, 20][Math.min(cargas, 5)];
  const limiteMaximo = CANASTA * canastas;
  const limitePorc = salarioAnual * 0.20;
  return Math.min(limiteMaximo, limitePorc);
}

function calcRebaja(totalDeducible, salarioAnual, cargas) {
  const limite = calcLimiteGP(salarioAnual, cargas);
  const deducibleEfectivo = Math.min(totalDeducible, limite);
  // IR table 2026 Ecuador - simplified calculation
  if (salarioAnual <= 11902) return 0;
  let ir = 0;
  const tramos = [
    [11902, 15159, 0, 0.05],
    [15159, 19682, 162.85, 0.10],
    [19682, 26031, 615.15, 0.12],
    [26031, 34255, 1376.83, 0.15],
    [34255, 45407, 2610.43, 0.20],
    [45407, 60450, 4840.83, 0.25],
    [60450, 80605, 8601.58, 0.30],
    [80605, Infinity, 14648.08, 0.35],
  ];
  for (const [min, max, base, rate] of tramos) {
    if (salarioAnual > min) {
      ir = base + (Math.min(salarioAnual, max) - min) * rate;
    }
  }
  const rebaja = (deducibleEfectivo / salarioAnual) * ir;
  return Math.round(rebaja * 100) / 100;
}

// ── Input styled ─────────────────────────────────────────────────────────────
function Input({ label, value, onChange, prefix, type = "text", placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", background: COLORS.offWhite, borderRadius: 12, border: `1.5px solid ${COLORS.grayLight}`, overflow: "hidden" }}>
        {prefix && <span style={{ padding: "0 10px 0 14px", color: COLORS.green, fontSize: 14, fontWeight: 700 }}>{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1, padding: "12px 14px", background: "transparent", border: "none", outline: "none",
            fontSize: 14, color: COLORS.green, fontFamily: "DM Sans, sans-serif", fontWeight: 600,
          }}
        />
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{ color: COLORS.green, fontSize: 11, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
      {children}
    </p>
  );
}

function GreenBtn({ children, onClick, outline, small, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: small ? "11px" : "15px",
      background: outline ? "transparent" : (disabled ? COLORS.grayLight : COLORS.green),
      color: outline ? COLORS.green : (disabled ? COLORS.gray : COLORS.white),
      border: outline ? `2px solid ${COLORS.green}` : "none",
      borderRadius: 14, fontSize: small ? 13 : 15, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "DM Sans, sans-serif", transition: "all 0.2s",
    }}>{children}</button>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function LemonTax() {
  const [screen, setScreen] = useState("dashboard");
  const [facturas, setFacturas] = useState(initialFacturas);
  const [perfil, setPerfil] = useState({ cedula: "", nombre: "", salario: "", cargas: "0", enfermedadCatastrofica: false });
  const [appLoading, setAppLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState("idle");

  // Load data from Supabase on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [{ data: facturasData }, { data: perfilData }] = await Promise.all([
          supabase.from("facturas").select("*").order("created_at", { ascending: false }),
          supabase.from("perfil").select("*").limit(1).maybeSingle(),
        ]);
        if (facturasData && facturasData.length > 0) {
          setFacturas(facturasData.map(f => ({
            id: f.id, emisor: f.emisor, ruc: f.ruc || "", fecha: f.fecha,
            monto: f.monto, categoria: f.categoria, sri: f.es_deducible_sri,
            comprobantes: f.comprobantes || 1,
          })));
        }
        if (perfilData) {
          setPerfil({
            cedula: perfilData.cedula || "",
            nombre: perfilData.nombre || "",
            salario: perfilData.salario_mensual?.toString() || "",
            otrosIngresos: perfilData.otros_ingresos?.toString() || "",
            cargas: perfilData.cargas_familiares?.toString() || "0",
            enfermedadCatastrofica: perfilData.enfermedad_catastrofica || false,
            _id: perfilData.id,
          });
        }
      } catch (e) {
        console.log("Usando datos locales");
      }
      setAppLoading(false);
    }
    loadData();
  }, []);

  // Manual save perfil
  const savePerfil = useCallback(async (perfilToSave) => {
    if (!navigator.onLine) {
      setSyncStatus("error");
      return;
    }
    setSyncStatus("saving");
    try {
      const payload = {
        cedula: perfilToSave.cedula,
        nombre: perfilToSave.nombre,
        salario_mensual: parseFloat(perfilToSave.salario) || 0,
        otros_ingresos: parseFloat(perfilToSave.otrosIngresos) || 0,
        cargas_familiares: parseInt(perfilToSave.cargas) || 0,
        enfermedad_catastrofica: perfilToSave.enfermedadCatastrofica || false,
      };
      if (perfilToSave._id) {
        await supabase.from("perfil").update(payload).eq("id", perfilToSave._id);
      } else {
        const { data } = await supabase.from("perfil").insert(payload).select().single();
        if (data) setPerfil(p => ({ ...p, _id: data.id }));
      }
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch (e) {
      setSyncStatus("error");
    }
  }, []);

  const updateCategoria = async (id, cat) => {
    if (!navigator.onLine) { setSyncStatus("error"); return; }
    setFacturas(prev => prev.map(f => f.id === id ? { ...f, categoria: cat } : f));
    setSyncStatus("saving");
    try {
      await supabase.from("facturas").update({ categoria: cat }).eq("id", id);
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch (e) { setSyncStatus("error"); }
  };

  // updatePerfil only updates local state, saving happens via button
  const updatePerfil = (k, v) => setPerfil(prev => ({ ...prev, [k]: v }));

  const totalGastos = facturas.reduce((a, b) => a + b.monto, 0);
  const totalDeducible = facturas.filter(f => f.sri).reduce((a, b) => a + b.monto, 0);
  const salarioAnual = parseFloat(perfil.salario) * 12 || 0;
  const cargas = parseInt(perfil.cargas) || 0;
  const rebaja = salarioAnual > 0 ? calcRebaja(totalDeducible, salarioAnual, cargas) : totalDeducible * 0.10;
  const limite = salarioAnual > 0 ? calcLimiteGP(salarioAnual, cargas) : 0;

  if (appLoading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#0F1F15", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 48 }}>🍋</p>
      <p style={{ color: "#F5E642", fontSize: 20, fontWeight: 800, fontFamily: "sans-serif" }}>Lemon Tax</p>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Cargando...</p>
    </div>
  );

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#0F1F15", fontFamily: "'DM Sans', sans-serif", padding: "20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        .tap:active { transform: scale(0.97); transition: 0.1s; }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .screen-enter { animation: slideUp 0.3s ease forwards; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .pulse { animation: pulse 2s infinite; }
        input::placeholder { color: #B0BEC5; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>

      <div style={{ width: 390, height: 844, background: COLORS.white, borderRadius: 44, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)" }}>
        <div style={{ background: COLORS.green, padding: "14px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "center", color: COLORS.white, fontSize: 12, fontWeight: 600 }}>
          <span>9:41</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {syncStatus === "saving" && <span style={{ fontSize: 10, color: COLORS.yellow }} className="pulse">⟳ Guardando</span>}
            {syncStatus === "saved" && <span style={{ fontSize: 10, color: COLORS.greenAccent }}>✓ Guardado</span>}
            {syncStatus === "error" && <span style={{ fontSize: 10, color: "#E05252" }}>✗ Sin conexión</span>}
            <span>WiFi</span><span>🔋</span>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {screen === "dashboard" && <DashboardScreen navigate={setScreen} facturas={facturas} total={totalGastos} deducible={totalDeducible} rebaja={rebaja} perfilOk={!!perfil.salario} />}
          {screen === "facturas" && <FacturasScreen facturas={facturas} updateCategoria={updateCategoria} />}
          {screen === "conectar" && <ConectarScreen facturas={facturas} setFacturas={setFacturas} setSyncStatus={setSyncStatus} />}
          {screen === "declaracion" && <DeclaracionScreen facturas={facturas} perfil={perfil} updatePerfil={updatePerfil} savePerfil={savePerfil} syncStatus={syncStatus} rebaja={rebaja} limite={limite} salarioAnual={salarioAnual} cargas={cargas} />}
        </div>

        <div style={{ background: COLORS.white, borderTop: `1px solid ${COLORS.grayLight}`, padding: "12px 8px 24px", display: "flex", justifyContent: "space-around" }}>
          {[
            { id: "dashboard", icon: "◉", label: "Inicio" },
            { id: "facturas", icon: "≡", label: "Facturas" },
            { id: "conectar", icon: "⊕", label: "Conectar" },
            { id: "declaracion", icon: "⊞", label: "Declarar" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setScreen(tab.id)} style={{ background: screen === tab.id ? COLORS.grayLight : "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 12, transition: "all 0.2s" }}>
              <span style={{ fontSize: 20, color: screen === tab.id ? COLORS.green : COLORS.gray }}>{tab.icon}</span>
              <span style={{ fontSize: 10, fontWeight: screen === tab.id ? 700 : 400, color: screen === tab.id ? COLORS.green : COLORS.gray }}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── FacturaRow ────────────────────────────────────────────────────────────────
function FacturaRow({ factura, onUpdateCategoria }) {
  const [editing, setEditing] = useState(false);
  return (
    <div style={{ background: COLORS.white, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: (categoriaColors[factura.categoria] || "#ccc") + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
          {categoriaIcons[factura.categoria] || "📋"}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: COLORS.green, fontSize: 13, fontWeight: 600 }}>{factura.emisor}</p>
          <p style={{ color: COLORS.gray, fontSize: 11, marginTop: 2 }}>{factura.fecha} · {factura.categoria}</p>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <p style={{ color: COLORS.green, fontSize: 14, fontWeight: 700 }}>${factura.monto.toFixed(2)}</p>
          <div style={{ display: "flex", gap: 4 }}>
            {factura.sri && <span style={{ fontSize: 9, background: "#E8F5E9", color: "#2E7D32", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>SRI ✓</span>}
            {onUpdateCategoria && (
              <button onClick={() => setEditing(!editing)} style={{ fontSize: 9, background: editing ? COLORS.yellow : COLORS.grayLight, color: COLORS.green, padding: "2px 6px", borderRadius: 4, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
                {editing ? "Cerrar" : "✏️ Editar"}
              </button>
            )}
          </div>
        </div>
      </div>
      {editing && onUpdateCategoria && (
        <div style={{ borderTop: `1px solid ${COLORS.grayLight}`, padding: "12px 16px", background: COLORS.offWhite }}>
          <p style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Cambiar categoría</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CATEGORIAS.map(cat => (
              <button key={cat} onClick={() => { onUpdateCategoria(factura.id, cat); setEditing(false); }} style={{ padding: "5px 10px", borderRadius: 16, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "DM Sans, sans-serif", background: factura.categoria === cat ? COLORS.green : COLORS.white, color: factura.categoria === cat ? COLORS.white : COLORS.green, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", transition: "all 0.15s" }}>{cat}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardScreen({ navigate, facturas, total, deducible, rebaja, perfilOk }) {
  return (
    <div className="screen-enter" style={{ flex: 1, overflowY: "auto", background: COLORS.offWhite }}>
      <div style={{ background: COLORS.green, padding: "20px 24px 40px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(245,230,66,0.08)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Bienvenido</p>
            <p style={{ color: COLORS.white, fontSize: 18, fontWeight: 700, fontFamily: "Syne, sans-serif" }}>Tomás García</p>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: COLORS.yellow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: COLORS.green, fontFamily: "Syne, sans-serif" }}>TG</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: "20px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Estimado de rebaja IR 2025</p>
          <p style={{ color: COLORS.yellow, fontSize: 36, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>${rebaja.toFixed(2)}</p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 4 }}>
            {perfilOk ? `Basado en $${deducible.toFixed(2)} en gastos deducibles` : "Ingresa tu salario para cálculo exacto →"}
          </p>
        </div>
      </div>

      <div style={{ padding: "0 20px", marginTop: 16 }}>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Total Gastos", value: `$${total.toFixed(2)}`, color: COLORS.green },
            { label: "Facturas", value: `${facturas.length}`, color: COLORS.greenAccent },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, background: COLORS.white, borderRadius: 16, padding: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
              <p style={{ color: COLORS.gray, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</p>
              <p style={{ color: s.color, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {!perfilOk && (
        <div style={{ margin: "16px 20px 0" }}>
          <div className="tap" onClick={() => navigate("declaracion")} style={{ background: COLORS.yellow, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <p style={{ color: COLORS.green, fontSize: 13, fontWeight: 700 }}>Registra tu salario</p>
              <p style={{ color: COLORS.green, fontSize: 11, opacity: 0.7 }}>Para calcular tu rebaja de IR exacta</p>
            </div>
            <span style={{ marginLeft: "auto", color: COLORS.green, fontWeight: 700 }}>→</span>
          </div>
        </div>
      )}

      <div style={{ padding: "20px 20px 0" }}>
        <p style={{ color: COLORS.green, fontSize: 13, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Acciones rápidas</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { icon: "📧", label: "Conectar Gmail", action: "conectar", bg: "#E8F5E9" },
            { icon: "📊", label: "Formularios SRI", action: "declaracion", bg: "#FFF9C4" },
            { icon: "🧾", label: "Mis Facturas", action: "facturas", bg: "#E3F2FD" },
            { icon: "📤", label: "Exportar Reporte", action: null, bg: "#F3E5F5" },
          ].map((a, i) => (
            <div key={i} className="tap" onClick={() => a.action && navigate(a.action)} style={{ background: COLORS.white, borderRadius: 16, padding: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{a.icon}</div>
              <p style={{ color: COLORS.green, fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{a.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ color: COLORS.green, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Recientes</p>
          <span onClick={() => navigate("facturas")} style={{ color: COLORS.greenAccent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Ver todas →</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {facturas.slice(0, 3).map(f => <FacturaRow key={f.id} factura={f} />)}
        </div>
      </div>
    </div>
  );
}

// ── Facturas ──────────────────────────────────────────────────────────────────
function FacturasScreen({ facturas, updateCategoria }) {
  const [filter, setFilter] = useState("Todas");
  const cats = ["Todas", ...new Set(facturas.map(f => f.categoria))];
  const filtered = filter === "Todas" ? facturas : facturas.filter(f => f.categoria === filter);

  return (
    <div className="screen-enter" style={{ flex: 1, overflowY: "auto", background: COLORS.offWhite }}>
      <div style={{ background: COLORS.green, padding: "20px 24px 24px" }}>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 }}>Febrero 2025</p>
        <p style={{ color: COLORS.white, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Mis Facturas</p>
      </div>
      <div style={{ padding: "16px 20px 8px", display: "flex", gap: 8, overflowX: "auto" }}>
        {cats.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", background: filter === cat ? COLORS.green : COLORS.white, color: filter === cat ? COLORS.white : COLORS.gray, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", transition: "all 0.2s", fontFamily: "DM Sans, sans-serif" }}>{cat}</button>
        ))}
      </div>
      <div style={{ padding: "8px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(f => <FacturaRow key={f.id} factura={f} onUpdateCategoria={updateCategoria} />)}
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

// ── Conectar ──────────────────────────────────────────────────────────────────
function ConectarScreen() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="screen-enter" style={{ flex: 1, overflowY: "auto", background: COLORS.offWhite }}>
      <div style={{ background: COLORS.green, padding: "20px 24px 24px" }}>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 }}>Fuentes de datos</p>
        <p style={{ color: COLORS.white, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Conectar Cuentas</p>
      </div>
      <div style={{ padding: "20px" }}>
        <p style={{ color: COLORS.gray, fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          Conecta tu correo para importar facturas electrónicas automáticamente. Lemon Tax detecta los XMLs del SRI en tu bandeja.
        </p>
        <div style={{ background: COLORS.white, borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", border: connected ? `2px solid ${COLORS.greenAccent}` : "2px solid transparent" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "#FDECEA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📧</div>
            <div style={{ flex: 1 }}>
              <p style={{ color: COLORS.green, fontSize: 15, fontWeight: 700 }}>Gmail</p>
              <p style={{ color: COLORS.gray, fontSize: 12 }}>Importar facturas del correo</p>
            </div>
            {connected && <span style={{ fontSize: 20 }}>✅</span>}
          </div>
          {connected ? (
            <div style={{ background: "#E8F5E9", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ color: "#2E7D32", fontSize: 13, fontWeight: 600 }}>Conectado</p>
                <p style={{ color: "#4CAF50", fontSize: 11 }}>6 facturas importadas</p>
              </div>
              <span className="pulse" style={{ fontSize: 8, color: "#4CAF50" }}>●</span>
            </div>
          ) : (
            <button onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); setConnected(true); }, 2000); }} style={{ width: "100%", padding: "13px", background: loading ? COLORS.grayLight : COLORS.green, color: loading ? COLORS.gray : COLORS.white, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
              {loading ? "Conectando..." : "Conectar con Google"}
            </button>
          )}
        </div>
        <div style={{ background: COLORS.white, borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", opacity: 0.6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "#E3F2FD", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📬</div>
            <div style={{ flex: 1 }}>
              <p style={{ color: COLORS.green, fontSize: 15, fontWeight: 700 }}>Outlook / Hotmail</p>
              <p style={{ color: COLORS.gray, fontSize: 12 }}>Próximamente disponible</p>
            </div>
            <span style={{ fontSize: 10, background: COLORS.yellow + "60", color: COLORS.green, padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>PRONTO</span>
          </div>
        </div>
        <div style={{ background: COLORS.white, borderRadius: 20, padding: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "#FFF9C4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📄</div>
            <div>
              <p style={{ color: COLORS.green, fontSize: 15, fontWeight: 700 }}>Subir XML del SRI</p>
              <p style={{ color: COLORS.gray, fontSize: 12 }}>Importación manual</p>
            </div>
          </div>
          <button style={{ width: "100%", padding: "13px", background: "transparent", color: COLORS.green, border: `2px solid ${COLORS.green}`, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
            Seleccionar archivo XML
          </button>
        </div>
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

// ── Declaración ───────────────────────────────────────────────────────────────
function DeclaracionScreen({ facturas, perfil, updatePerfil, savePerfil, syncStatus, rebaja, limite, salarioAnual, cargas }) {
  const [tab, setTab] = useState("perfil"); // perfil | gp | anexo
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const catTotals = {};
  facturas.filter(f => f.sri).forEach(f => { catTotals[f.categoria] = (catTotals[f.categoria] || 0) + f.monto; });
  const totalDeducible = Object.values(catTotals).reduce((a, b) => a + b, 0);
  const deducibleEfectivo = limite > 0 ? Math.min(totalDeducible, limite) : totalDeducible;

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2500);
  };

  const perfilValido = perfil.cedula && perfil.nombre && perfil.salario;

  return (
    <div className="screen-enter" style={{ flex: 1, overflowY: "auto", background: COLORS.offWhite }}>
      {/* Header */}
      <div style={{ background: COLORS.green, padding: "20px 24px 20px" }}>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 }}>Período fiscal 2025</p>
        <p style={{ color: COLORS.white, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Formularios SRI</p>
      </div>

      {/* Tabs */}
      <div style={{ background: COLORS.white, padding: "12px 20px", display: "flex", gap: 8, borderBottom: `1px solid ${COLORS.grayLight}` }}>
        {[
          { id: "perfil", label: "👤 Perfil" },
          { id: "gp", label: "📋 Form. GP" },
          { id: "anexo", label: "📄 Anexo GSP" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: tab === t.id ? COLORS.green : COLORS.grayLight, color: tab === t.id ? COLORS.white : COLORS.gray, transition: "all 0.2s", fontFamily: "DM Sans, sans-serif" }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "20px" }}>

        {/* ── TAB: PERFIL ── */}
        {tab === "perfil" && (
          <div>
            <div style={{ background: COLORS.green, borderRadius: 20, padding: "16px 20px", marginBottom: 20 }}>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginBottom: 6 }}>Rebaja estimada de IR</p>
              <p style={{ color: COLORS.yellow, fontSize: 30, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>${rebaja.toFixed(2)}</p>
              {limite > 0 && (
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4 }}>
                  Límite deducible: ${limite.toFixed(2)} · Efectivo: ${deducibleEfectivo.toFixed(2)}
                </p>
              )}
            </div>

            <SectionLabel>Datos personales</SectionLabel>
            <Input label="Cédula o Pasaporte" value={perfil.cedula} onChange={v => updatePerfil("cedula", v)} placeholder="1700000000" />
            <Input label="Apellidos y Nombres Completos" value={perfil.nombre} onChange={v => updatePerfil("nombre", v)} placeholder="García Pérez Tomás" />

            <SectionLabel>Datos laborales</SectionLabel>
            <Input label="Salario mensual (USD)" value={perfil.salario} onChange={v => updatePerfil("salario", v)} prefix="$" type="number" placeholder="0.00" />
            <Input label="Ingresos con otros empleadores (mensual)" value={perfil.otrosIngresos || ""} onChange={v => updatePerfil("otrosIngresos", v)} prefix="$" type="number" placeholder="0.00" />

            <SectionLabel>Cargas familiares</SectionLabel>
            <div style={{ marginBottom: 14 }}>
              <p style={{ color: COLORS.gray, fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Número de cargas</p>
              <div style={{ display: "flex", gap: 8 }}>
                {["0","1","2","3","4","5+"].map(n => (
                  <button key={n} onClick={() => updatePerfil("cargas", n === "5+" ? "5" : n)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: perfil.cargas === (n === "5+" ? "5" : n) ? COLORS.green : COLORS.white, color: perfil.cargas === (n === "5+" ? "5" : n) ? COLORS.white : COLORS.green, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", fontFamily: "DM Sans, sans-serif" }}>{n}</button>
                ))}
              </div>
            </div>

            <div style={{ background: COLORS.white, borderRadius: 14, padding: "14px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div>
                <p style={{ color: COLORS.green, fontSize: 13, fontWeight: 600 }}>Enfermedad catastrófica</p>
                <p style={{ color: COLORS.gray, fontSize: 11 }}>Persona o carga familiar</p>
              </div>
              <button onClick={() => updatePerfil("enfermedadCatastrofica", !perfil.enfermedadCatastrofica)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: perfil.enfermedadCatastrofica ? COLORS.greenAccent : COLORS.grayLight, position: "relative", transition: "all 0.2s" }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: COLORS.white, position: "absolute", top: 3, left: perfil.enfermedadCatastrofica ? 23 : 3, transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </button>
            </div>

            {salarioAnual > 0 && (
              <div style={{ background: "#E8F5E9", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
                <p style={{ color: "#2E7D32", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>📊 Resumen de cálculo</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    ["Salario anual", `$${salarioAnual.toFixed(2)}`],
                    ["Canasta familiar (2026)", `$${CANASTA.toFixed(2)}`],
                    [`Límite deducible (${cargas} cargas)`, `$${limite.toFixed(2)}`],
                    ["Total gastos SRI", `$${totalDeducible.toFixed(2)}`],
                    ["Gastos efectivos", `$${deducibleEfectivo.toFixed(2)}`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#388E3C", fontSize: 11 }}>{k}</span>
                      <span style={{ color: "#1B5E20", fontSize: 11, fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Offline error */}
            {syncStatus === "error" && (
              <div style={{ background: "#FFEBEE", borderRadius: 12, padding: "12px 16px", marginBottom: 12, border: "1px solid #FFCDD2" }}>
                <p style={{ color: "#C62828", fontSize: 12, fontWeight: 600 }}>⚠️ Sin conexión a internet</p>
                <p style={{ color: "#E53935", fontSize: 11, marginTop: 2 }}>Conéctate para guardar tus datos</p>
              </div>
            )}

            {/* Save button */}
            <button
              onClick={() => savePerfil(perfil)}
              disabled={syncStatus === "saving"}
              style={{
                width: "100%", padding: "15px",
                background: syncStatus === "saving" ? COLORS.grayLight : syncStatus === "saved" ? COLORS.greenAccent : COLORS.green,
                color: syncStatus === "saving" ? COLORS.gray : COLORS.white,
                border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700,
                cursor: syncStatus === "saving" ? "not-allowed" : "pointer",
                fontFamily: "DM Sans, sans-serif", transition: "all 0.3s",
                marginBottom: 6,
              }}
            >
              {syncStatus === "saving" ? "Guardando..." : syncStatus === "saved" ? "✓ Guardado" : "💾 Guardar perfil"}
            </button>
          </div>
        )}

        {/* ── TAB: FORMULARIO GP ── */}
        {tab === "gp" && (
          <div>
            <div style={{ background: "#FFF9C4", borderRadius: 14, padding: "12px 16px", marginBottom: 16, border: "1px solid #F9E000" }}>
              <p style={{ color: "#5D4037", fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>
                📋 <strong>Formulario SRI-GP</strong> — Se presenta a tu empleador en febrero. Declara tus gastos personales <em>proyectados</em> para que calculen la retención mensual correcta.
              </p>
            </div>

            {/* Ingresos */}
            <SectionLabel>Ingresos proyectados</SectionLabel>
            <div style={{ background: COLORS.white, borderRadius: 14, padding: "14px 16px", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              {[
                ["103", "Ingresos con este empleador", perfil.salario ? `$${(parseFloat(perfil.salario) * 12).toFixed(2)}` : "—"],
                ["104", "Ingresos con otros empleadores", perfil.otrosIngresos ? `$${(parseFloat(perfil.otrosIngresos) * 12).toFixed(2)}` : "$0.00"],
                ["105", "Total ingresos proyectados", perfil.salario ? `$${(salarioAnual + (parseFloat(perfil.otrosIngresos || 0) * 12)).toFixed(2)}` : "—"],
              ].map(([cod, label, val]) => (
                <div key={cod} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: cod !== "105" ? `1px solid ${COLORS.grayLight}` : "none" }}>
                  <div>
                    <span style={{ fontSize: 9, background: COLORS.grayLight, color: COLORS.gray, padding: "1px 5px", borderRadius: 4, fontWeight: 700, marginRight: 6 }}>{cod}</span>
                    <span style={{ color: COLORS.green, fontSize: 12 }}>{label}</span>
                  </div>
                  <span style={{ color: cod === "105" ? COLORS.green : COLORS.gray, fontSize: 13, fontWeight: cod === "105" ? 800 : 600 }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Gastos proyectados */}
            <SectionLabel>Gastos proyectados (campos 106–112)</SectionLabel>
            <div style={{ background: COLORS.white, borderRadius: 14, overflow: "hidden", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              {Object.entries(CAT_SRI).map(([cat, { field, color }], i, arr) => {
                // Project annual from current monthly data (multiply by 12 as projection)
                const mensual = catTotals[cat] || 0;
                const anual = mensual * 12;
                return (
                  <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.grayLight}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 9, background: color + "20", color: color, padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>{field}</span>
                      <span style={{ color: COLORS.green, fontSize: 12 }}>{cat}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ color: COLORS.green, fontSize: 13, fontWeight: 700 }}>${anual.toFixed(2)}</p>
                      <p style={{ color: COLORS.gray, fontSize: 10 }}>${mensual.toFixed(2)}/mes</p>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: COLORS.green }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, background: "rgba(255,255,255,0.2)", color: COLORS.white, padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>112</span>
                  <span style={{ color: COLORS.white, fontSize: 12, fontWeight: 600 }}>Total gastos proyectados</span>
                </div>
                <span style={{ color: COLORS.yellow, fontSize: 14, fontWeight: 800 }}>${(totalDeducible * 12).toFixed(2)}</span>
              </div>
            </div>

            {/* Rebaja */}
            <div style={{ background: COLORS.white, borderRadius: 14, padding: "14px 16px", marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              {[
                ["113", "Discapacidad / Enfermedad catastrófica", perfil.enfermedadCatastrofica ? "SÍ" : "NO"],
                ["114", "Número de cargas familiares", perfil.cargas || "0"],
                ["115", "Rebaja IR por gastos personales", `$${rebaja.toFixed(2)}`],
              ].map(([cod, label, val]) => (
                <div key={cod} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: cod !== "115" ? `1px solid ${COLORS.grayLight}` : "none" }}>
                  <div>
                    <span style={{ fontSize: 9, background: COLORS.grayLight, color: COLORS.gray, padding: "1px 5px", borderRadius: 4, fontWeight: 700, marginRight: 6 }}>{cod}</span>
                    <span style={{ color: COLORS.green, fontSize: 12 }}>{label}</span>
                  </div>
                  <span style={{ color: cod === "115" ? COLORS.greenAccent : COLORS.green, fontSize: 13, fontWeight: 700 }}>{val}</span>
                </div>
              ))}
            </div>

            {!generated ? (
              <>
                <GreenBtn onClick={handleGenerate} disabled={!perfilValido || generating}>
                  {generating ? "Generando Excel..." : "Generar Formulario GP (.xlsx)"}
                </GreenBtn>
                {!perfilValido && <p style={{ color: COLORS.gray, fontSize: 11, textAlign: "center", marginTop: 8 }}>Completa tu perfil primero</p>}
              </>
            ) : (
              <div style={{ background: "#E8F5E9", borderRadius: 16, padding: "16px", marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#C8E6C9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📊</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "#2E7D32", fontSize: 13, fontWeight: 700 }}>Formulario_GP_2025.xlsx</p>
                    <p style={{ color: "#4CAF50", fontSize: 11 }}>Generado · {new Date().toLocaleDateString("es-EC")}</p>
                  </div>
                  <span style={{ color: "#4CAF50", fontSize: 18 }}>✅</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      const link = document.createElement("a");
                      const csvContent = [
                        ["FORMULARIO SRI-GP 2025"],
                        [""],
                        ["CAMPO", "DESCRIPCIÓN", "VALOR"],
                        ["101", "Cédula", perfil.cedula],
                        ["102", "Nombres", perfil.nombre],
                        ["103", "Ingresos con empleador (anual)", `$${(parseFloat(perfil.salario||0)*12).toFixed(2)}`],
                        ["104", "Ingresos otros empleadores (anual)", `$${(parseFloat(perfil.otrosIngresos||0)*12).toFixed(2)}`],
                        ["105", "Total ingresos proyectados", `$${(salarioAnual + parseFloat(perfil.otrosIngresos||0)*12).toFixed(2)}`],
                        ["106", "Gastos Vivienda", `$${((catTotals["Vivienda"]||0)*12).toFixed(2)}`],
                        ["107", "Gastos Educación Arte y Cultura", `$${((catTotals["Educación"]||0)*12).toFixed(2)}`],
                        ["108", "Gastos Salud", `$${((catTotals["Salud"]||0)*12).toFixed(2)}`],
                        ["109", "Gastos Vestimenta", `$${((catTotals["Vestimenta"]||0)*12).toFixed(2)}`],
                        ["110", "Gastos Alimentación", `$${((catTotals["Alimentación"]||0)*12).toFixed(2)}`],
                        ["111", "Gastos Turismo", `$${((catTotals["Turismo"]||0)*12).toFixed(2)}`],
                        ["112", "Total gastos proyectados", `$${(totalDeducible*12).toFixed(2)}`],
                        ["113", "Enfermedad catastrófica", perfil.enfermedadCatastrofica ? "SÍ" : "NO"],
                        ["114", "Cargas familiares", perfil.cargas||"0"],
                        ["115", "Rebaja IR por gastos personales", `$${rebaja.toFixed(2)}`],
                      ].map(r => r.join(",")).join("\n");
                      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
                      link.href = URL.createObjectURL(blob);
                      link.download = `Formulario_GP_2025_${perfil.cedula || "SRI"}.csv`;
                      link.click();
                    }}
                    style={{ flex: 1, padding: "12px", background: COLORS.green, color: COLORS.white, border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    ⬇️ Descargar
                  </button>
                  <button
                    onClick={() => setGenerated(false)}
                    style={{ padding: "12px 16px", background: "transparent", color: "#2E7D32", border: "2px solid #A5D6A7", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}
                  >
                    🔄 Regenerar
                  </button>
                </div>
                <p style={{ color: "#4CAF50", fontSize: 10, textAlign: "center", marginTop: 8 }}>
                  Nota: descarga en .csv · compatible con Excel
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ANEXO GSP ── */}
        {tab === "anexo" && (
          <div>
            <div style={{ background: "#E3F2FD", borderRadius: 14, padding: "12px 16px", marginBottom: 16, border: "1px solid #BBDEFB" }}>
              <p style={{ color: "#1565C0", fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>
                📄 <strong>Anexo de Gastos Personales</strong> — Refleja los gastos <em>reales</em> del año. Se presenta junto al Formulario 107 que genera tu empleador.
              </p>
            </div>

            <SectionLabel>Detalle por proveedor</SectionLabel>
            <div style={{ background: COLORS.white, borderRadius: 14, overflow: "hidden", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", padding: "8px 14px", background: COLORS.grayLight }}>
                <span style={{ color: COLORS.gray, fontSize: 10, fontWeight: 700, flex: 2 }}>PROVEEDOR</span>
                <span style={{ color: COLORS.gray, fontSize: 10, fontWeight: 700, flex: 1, textAlign: "center" }}>COMP.</span>
                <span style={{ color: COLORS.gray, fontSize: 10, fontWeight: 700, flex: 1, textAlign: "right" }}>BASE IMP.</span>
              </div>
              {facturas.filter(f => f.sri).map((f, i) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: i < facturas.filter(x => x.sri).length - 1 ? `1px solid ${COLORS.grayLight}` : "none" }}>
                  <div style={{ flex: 2 }}>
                    <p style={{ color: COLORS.green, fontSize: 12, fontWeight: 600 }}>{f.emisor}</p>
                    <p style={{ color: COLORS.gray, fontSize: 10 }}>{f.ruc}</p>
                  </div>
                  <span style={{ flex: 1, textAlign: "center", color: COLORS.gray, fontSize: 12 }}>{f.comprobantes}</span>
                  <span style={{ flex: 1, textAlign: "right", color: COLORS.green, fontSize: 12, fontWeight: 700 }}>${f.monto.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: COLORS.green }}>
                <span style={{ color: COLORS.white, fontSize: 12, fontWeight: 600 }}>Total gastos reales</span>
                <span style={{ color: COLORS.yellow, fontSize: 13, fontWeight: 800 }}>${facturas.filter(f => f.sri).reduce((a, b) => a + b.monto, 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Categorías SRI */}
            <SectionLabel>Por tipo de gasto SRI</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {Object.entries(CAT_SRI).map(([cat, { field, color }]) => {
                const monto = catTotals[cat] || 0;
                return (
                  <div key={cat} style={{ background: COLORS.white, borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{categoriaIcons[cat]}</span>
                      <span style={{ color: COLORS.green, fontSize: 12, fontWeight: 600 }}>{cat}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 60, height: 4, borderRadius: 2, background: COLORS.grayLight }}>
                        <div style={{ width: `${Math.min((monto / 500) * 100, 100)}%`, height: "100%", borderRadius: 2, background: color, minWidth: monto > 0 ? 4 : 0 }} />
                      </div>
                      <span style={{ color: monto > 0 ? COLORS.green : COLORS.gray, fontSize: 13, fontWeight: 700, minWidth: 60, textAlign: "right" }}>${monto.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <GreenBtn onClick={handleGenerate} disabled={!perfilValido || generating}>
              {generating ? "Generando Excel..." : generated ? "✅ Anexo GSP generado" : "Generar Anexo GSP (.xlsx)"}
            </GreenBtn>
            <div style={{ marginTop: 10 }}>
              <GreenBtn outline onClick={() => {}} small>Generar ambos formularios</GreenBtn>
            </div>
            {!perfilValido && <p style={{ color: COLORS.gray, fontSize: 11, textAlign: "center", marginTop: 8 }}>Completa tu perfil primero</p>}
            {generated && (
              <div style={{ background: "#E8F5E9", borderRadius: 12, padding: "12px 16px", marginTop: 12 }}>
                <p style={{ color: "#2E7D32", fontSize: 13, fontWeight: 600 }}>📥 Anexo_GSP_2025.xlsx</p>
                <p style={{ color: "#4CAF50", fontSize: 11, marginTop: 2 }}>Con detalle por RUC proveedor y tipo de gasto</p>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}
