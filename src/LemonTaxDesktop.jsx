import { useState, useEffect } from "react";
import { generarFormularioGP, generarAnexoGSP } from "./sriExport";
import { useAuth } from "./auth.jsx";
import { supabase } from "./supabase";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0D1F14",
  surface: "#132218",
  card: "#1A2E20",
  border: "#243B2A",
  green: "#1A3A2A",
  greenMid: "#2D5A3D",
  greenAccent: "#4CAF82",
  yellow: "#F5E642",
  yellowDim: "#F5E64230",
  white: "#FFFFFF",
  text: "#E8F0EA",
  textMid: "#8FA894",
  textDim: "#4A6350",
  red: "#E05252",
  blue: "#52A8E0",
  purple: "#9C52E0",
  orange: "#E09652",
  pink: "#F06292",
  teal: "#26C6DA",
};

const catColors = {
  "Alimentación": C.greenAccent,
  "Salud": C.blue,
  "Educación": C.purple,
  "Vivienda": C.orange,
  "Vestimenta": C.pink,
  "Turismo": C.teal,
  "Transporte": "#52C4E0",
  "Servicios": "#E09652",
  "Entretenimiento": C.red,
  "Otros": "#90A4AE",
};

const catIcons = {
  "Alimentación": "🛒", "Salud": "💊", "Educación": "📚",
  "Vivienda": "🏠", "Vestimenta": "👕", "Turismo": "✈️",
  "Transporte": "⛽", "Servicios": "📱", "Entretenimiento": "🎬", "Otros": "📋",
};

const CAT_SRI = {
  "Vivienda": { field: 106 }, "Educación": { field: 107 },
  "Salud": { field: 108 }, "Vestimenta": { field: 109 },
  "Alimentación": { field: 110 }, "Turismo": { field: 111 },
};

const CANASTA = 821.80;

const MOCK_FACTURAS = [
  { id: 1, emisor: "Supermaxi", ruc: "1790000000001", fecha: "2025-02-18", monto: 147.80, categoria: "Alimentación", sri: true, comprobantes: 3 },
  { id: 2, emisor: "Farmacia Cruz Azul", ruc: "1780000000001", fecha: "2025-02-16", monto: 89.50, categoria: "Salud", sri: true, comprobantes: 2 },
  { id: 3, emisor: "Claro Ecuador", ruc: "1790000000002", fecha: "2025-02-14", monto: 35.00, categoria: "Servicios", sri: true, comprobantes: 1 },
  { id: 4, emisor: "Librería Española", ruc: "1690000000001", fecha: "2025-02-12", monto: 218.90, categoria: "Educación", sri: true, comprobantes: 5 },
  { id: 5, emisor: "Netflix Ecuador", ruc: "1790000000003", fecha: "2025-02-10", monto: 12.99, categoria: "Entretenimiento", sri: false, comprobantes: 1 },
  { id: 6, emisor: "Shell Gasolinera", ruc: "0980000000001", fecha: "2025-02-08", monto: 55.00, categoria: "Transporte", sri: true, comprobantes: 1 },
  { id: 7, emisor: "Coral Hipermercados", ruc: "0990000000001", fecha: "2025-02-05", monto: 203.40, categoria: "Alimentación", sri: true, comprobantes: 4 },
  { id: 8, emisor: "Clínica Kennedy", ruc: "0990000000002", fecha: "2025-02-03", monto: 320.00, categoria: "Salud", sri: true, comprobantes: 2 },
  { id: 9, emisor: "De Prati", ruc: "0990000000003", fecha: "2025-01-28", monto: 156.00, categoria: "Vestimenta", sri: true, comprobantes: 2 },
  { id: 10, emisor: "Inmobiliaria Uribe", ruc: "1790000000004", fecha: "2025-01-01", monto: 480.00, categoria: "Vivienda", sri: true, comprobantes: 1 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcLimite(salarioAnual, cargas) {
  const canastas = [7, 9, 11, 14, 17, 20][Math.min(cargas, 5)];
  return Math.min(CANASTA * canastas, salarioAnual * 0.20);
}

function calcRebaja(totalDeducible, salarioAnual, cargas) {
  if (salarioAnual <= 11902) return 0;
  const tramos = [
    [11902, 15159, 0, 0.05], [15159, 19682, 162.85, 0.10],
    [19682, 26031, 615.15, 0.12], [26031, 34255, 1376.83, 0.15],
    [34255, 45407, 2610.43, 0.20], [45407, 60450, 4840.83, 0.25],
    [60450, 80605, 8601.58, 0.30], [80605, Infinity, 14648.08, 0.35],
  ];
  let ir = 0;
  for (const [min, max, base, rate] of tramos) {
    if (salarioAnual > min) ir = base + (Math.min(salarioAnual, max) - min) * rate;
  }
  const limite = calcLimite(salarioAnual, cargas);
  const efectivo = Math.min(totalDeducible, limite);
  return Math.round((efectivo / salarioAnual) * ir * 100) / 100;
}

function fmt(n) { return `$${n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

// ─── Micro components ─────────────────────────────────────────────────────────
function Badge({ children, color }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: color + "20", color }}>
      {children}
    </span>
  );
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: C.textMid, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{label}</p>
          <p style={{ color: accent || C.yellow, fontSize: 28, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ color: C.textDim, fontSize: 12, marginTop: 6 }}>{sub}</p>}
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: (accent || C.yellow) + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ screen, setScreen }) {
  const items = [
    { id: "dashboard", icon: "home", label: "Inicio" },
    { id: "facturas", icon: "receipt", label: "Facturas" },
    { id: "declaracion", icon: "check_circle", label: "Tu declaración" },
    { id: "conectar", icon: "sync", label: "Sincronizar" },
  ];
  return (
    <div style={{ width: 220, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: "28px 24px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="30" height="30" viewBox="0 0 56 56" fill="none" style={{flexShrink:0}}>
              <rect width="56" height="56" rx="14" fill="#F5E642"/>
              <path d="M14 28.5L23.5 38L42 19" stroke="#1A3A2A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <p style={{ color: C.yellow, fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>facilito</p>
              <p style={{ color: C.textDim, fontSize: 10, marginTop: 2 }}>tus impuestos, facilito</p>
            </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "8px 12px", flex: 1 }}>
        {items.map(item => {
          const active = screen === item.id;
          return (
            <button key={item.id} onClick={() => setScreen(item.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
              background: active ? C.yellowDim : "transparent",
              marginBottom: 4, transition: "all 0.15s", textAlign: "left",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
              {item.icon === "home"         && <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill={active ? C.yellow : C.textDim}/>}
              {item.icon === "receipt"      && <path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5z" fill={active ? C.yellow : C.textDim}/>}
              {item.icon === "check_circle" && <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill={active ? C.yellow : C.textDim}/>}
              {item.icon === "sync"         && <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill={active ? C.yellow : C.textDim}/>}
            </svg>
              <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.yellow : C.textMid, fontFamily: "DM Sans, sans-serif" }}>{item.label}</span>
              {active && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: 2, background: C.yellow }} />}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: "16px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: C.yellow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: C.green, fontFamily: "Syne, sans-serif" }}>TG</div>
          <div>
            <p style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>Tomás García</p>
            <p style={{ color: C.textDim, fontSize: 10 }}>tomas@industryft.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inicio Screen ─────────────────────────────────────────────────────────
function InicioDesktop({ facturas, perfil, navigate }) {
  const total = facturas.reduce((a, b) => a + b.monto, 0);
  const deducible = facturas.filter(f => f.sri).reduce((a, b) => a + b.monto, 0);
  const salarioAnual = parseFloat(perfil.salario || 0) * 12;
  const cargas = parseInt(perfil.cargas || 0);
  const rebaja = salarioAnual > 0 ? calcRebaja(deducible, salarioAnual, cargas) : deducible * 0.10;
  const limite = calcLimite(salarioAnual, cargas);

  // Category breakdown
  const catTotals = {};
  facturas.filter(f => f.sri).forEach(f => { catTotals[f.categoria] = (catTotals[f.categoria] || 0) + f.monto; });
  const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ padding: "32px", overflowY: "auto", flex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Inicio</h1>
        <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Todo bien, estás al día · 2025</p>
      </div>

      {/* Alert if no salary */}
      {!perfil.salario && (
        <div onClick={() => navigate("declaracion")} style={{ background: C.yellowDim, border: `1px solid ${C.yellow}40`, borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: C.yellow, fontSize: 13, fontWeight: 700 }}>Agrega tu salario para ver tu rebaja exacta</p>
            <p style={{ color: C.yellow, opacity: 0.7, fontSize: 12 }}>Toca aquí para completar tu declaración →</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <StatCard icon="💰" label="Rebaja estimada IR" value={fmt(rebaja)} sub="Basado en gastos deducibles" accent={C.yellow} />
        <StatCard icon="🧾" label="Total gastos" value={fmt(total)} sub={`${facturas.length} facturas registradas`} accent={C.greenAccent} />
        <StatCard icon="✅" label="Gastos deducibles" value={fmt(deducible)} sub={`Límite: ${fmt(limite)}`} accent={C.blue} />
        <StatCard icon="📊" label="% del límite usado" value={limite > 0 ? `${Math.min(Math.round(deducible / limite * 100), 100)}%` : "—"} sub="Capacidad de deducción" accent={C.purple} />
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>

        {/* Recent facturas */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Facturas recientes</p>
            <button onClick={() => navigate("facturas")} style={{ color: C.greenAccent, fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Ver todas →</button>
          </div>
          <div>
            {facturas.slice(0, 6).map((f, i) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", padding: "12px 20px", borderBottom: i < 5 ? `1px solid ${C.border}` : "none", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: (catColors[f.categoria] || "#ccc") + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  {catIcons[f.categoria] || "📋"}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{f.emisor}</p>
                  <p style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{f.fecha} · {f.categoria}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{fmt(f.monto)}</p>
                  {f.sri && <Badge color={C.greenAccent}>SRI ✓</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Category breakdown */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Gastos por categoría</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {topCats.map(([cat, monto]) => (
                <div key={cat}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ color: C.textMid, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{catIcons[cat]}</span>{cat}
                    </span>
                    <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{fmt(monto)}</span>
                  </div>
                  <div style={{ height: 5, background: C.border, borderRadius: 3 }}>
                    <div style={{ height: "100%", borderRadius: 3, background: catColors[cat] || C.greenAccent, width: `${Math.min((monto / deducible) * 100, 100)}%`, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Acciones rápidas</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "📧", label: "Importar facturas desde Gmail", action: "conectar" },
                { icon: "📋", label: "Generar Formulario GP", action: "declaracion" },
                { icon: "📄", label: "Generar Anexo GSP", action: "declaracion" },
              ].map((a, i) => (
                <button key={i} onClick={() => navigate(a.action)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 16 }}>{a.icon}</span>
                  <span style={{ color: C.textMid, fontSize: 12, fontWeight: 500, fontFamily: "DM Sans, sans-serif" }}>{a.label}</span>
                  <span style={{ marginLeft: "auto", color: C.textDim, fontSize: 12 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Facturas Screen ──────────────────────────────────────────────────────────
function FacturasDesktop({ facturas, setFacturas }) {
  const [filter, setFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editCat, setEditCat] = useState("");

  const cats = ["Todas", ...Object.keys(catColors)];
  const filtered = facturas
    .filter(f => filter === "Todas" || f.categoria === filter)
    .filter(f => f.emisor.toLowerCase().includes(search.toLowerCase()) || f.ruc.includes(search));

  const total = filtered.reduce((a, b) => a + b.monto, 0);
  const deducible = filtered.filter(f => f.sri).reduce((a, b) => a + b.monto, 0);

  const saveEdit = async (id) => {
    setFacturas(prev => prev.map(f => f.id === id ? { ...f, categoria: editCat } : f));
    setEditingId(null);
    await supabase.from("facturas").update({ categoria: editCat }).eq("id", id);
  };

  return (
    <div style={{ padding: "32px", overflowY: "auto", flex: 1 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Facturas</h1>
        <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Gestiona tus comprobantes de gastos personales</p>
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total filtrado", value: fmt(total), color: C.text },
          { label: "Deducible SRI", value: fmt(deducible), color: C.greenAccent },
          { label: "Facturas", value: filtered.length, color: C.yellow },
        ].map((s, i) => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 20px", display: "flex", gap: 12, alignItems: "center" }}>
            <p style={{ color: C.textDim, fontSize: 12 }}>{s.label}</p>
            <p style={{ color: s.color, fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por emisor o RUC..."
          style={{ padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, outline: "none", width: 260, fontFamily: "DM Sans, sans-serif" }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {cats.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${filter === cat ? C.yellow : C.border}`, background: filter === cat ? C.yellowDim : "transparent", color: filter === cat ? C.yellow : C.textMid, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", transition: "all 0.15s" }}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 120px 100px 90px 90px 100px", padding: "12px 20px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
          {["Emisor / RUC", "Categoría", "Fecha", "Comprobantes", "Monto", "SRI", "Acción"].map(h => (
            <p key={h} style={{ color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</p>
          ))}
        </div>
        {/* Rows */}
        {filtered.map((f, i) => (
          <div key={f.id}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 120px 100px 90px 90px 100px", padding: "13px 20px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: (catColors[f.categoria] || "#ccc") + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{catIcons[f.categoria] || "📋"}</div>
                <div>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{f.emisor}</p>
                  <p style={{ color: C.textDim, fontSize: 11 }}>{f.ruc}</p>
                </div>
              </div>
              <div>
                {editingId === f.id ? (
                  <select value={editCat} onChange={e => setEditCat(e.target.value)} style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "DM Sans, sans-serif", outline: "none" }}>
                    {Object.keys(catColors).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <Badge color={catColors[f.categoria] || "#ccc"}>{f.categoria}</Badge>
                )}
              </div>
              <p style={{ color: C.textMid, fontSize: 12 }}>{f.fecha}</p>
              <p style={{ color: C.textMid, fontSize: 12, textAlign: "center" }}>{f.comprobantes}</p>
              <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{fmt(f.monto)}</p>
              <div>{f.sri ? <Badge color={C.greenAccent}>SRI ✓</Badge> : <Badge color={C.textDim}>No</Badge>}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {editingId === f.id ? (
                  <>
                    <button onClick={() => saveEdit(f.id)} style={{ fontSize: 11, padding: "4px 8px", background: C.greenAccent + "20", color: C.greenAccent, border: `1px solid ${C.greenAccent}40`, borderRadius: 6, cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontWeight: 700 }}>✓</button>
                    <button onClick={() => setEditingId(null)} style={{ fontSize: 11, padding: "4px 8px", background: "transparent", color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>✕</button>
                  </>
                ) : (
                  <button onClick={() => { setEditingId(f.id); setEditCat(f.categoria); }} style={{ fontSize: 11, padding: "4px 10px", background: "transparent", color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontWeight: 600 }}>Editar</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Conectar Screen ──────────────────────────────────────────────────────────
function ConectarDesktop({ facturas, setFacturas, setSyncStatus, saveFacturas }) {
  const { triggerSync } = useAuth();
  const [estado, setEstado]     = useState("idle"); // idle | syncing | success | error
  const [resultado, setResultado] = useState(null);
  const [lastSync, setLastSync]   = useState(null);
  const { supabase: sb } = (() => { try { return { supabase: window._supabase }; } catch { return { supabase: null }; } })();

  // Cargar último sync al montar
  useEffect(() => {
    import("./supabase").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase
          .from("gmail_tokens")
          .select("last_sync")
          .eq("user_id", user.id)
          .single()
          .then(({ data }) => { if (data?.last_sync) setLastSync(new Date(data.last_sync)); });
      });
    });
  }, []);

  const handleSync = async () => {
    setEstado("syncing");
    setResultado(null);
    try {
      const res = await triggerSync();
      const r = res.resultados?.[0];
      setResultado({
        nuevas:     r?.nuevas     ?? 0,
        duplicadas: r?.duplicadas ?? 0,
        errores:    r?.errores    ?? 0,
      });
      setLastSync(new Date());
      if ((r?.nuevas ?? 0) > 0) {
        // Recargar facturas desde Supabase
        const { importarDesdeSupabase } = await import("./supabase");
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus("idle"), 2000);
      }
      setEstado("success");
    } catch (e) {
      console.error(e);
      setEstado("error");
      setResultado({ mensaje: e.message || "Error al sincronizar" });
    }
  };

  const formatLastSync = (date) => {
    if (!date) return "Nunca";
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1) return "Hace un momento";
    if (diff < 60) return `Hace ${diff} min`;
    if (diff < 1440) return `Hace ${Math.floor(diff / 60)}h`;
    return date.toLocaleDateString("es-EC");
  };

  return (
    <div style={{ padding: "32px", overflowY: "auto", flex: 1 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Conectar</h1>
        <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Tus facturas llegan solas — facilito.</p>
      </div>

      <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Gmail sync card */}
        <div style={{ background: C.card, border: `1px solid ${estado === "success" ? C.greenAccent : C.border}`, borderRadius: 16, padding: "24px" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#FDECEA30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>📧</div>
            <div style={{ flex: 1 }}>

              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <p style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>Gmail — Sync automático</p>
                <Badge color={C.greenAccent}>✓ Conectado</Badge>
              </div>

              {/* Último sync */}
              <p style={{ color: C.textDim, fontSize: 12, marginBottom: 12 }}>
                Último sync: <span style={{ color: C.textMid }}>{formatLastSync(lastSync)}</span>
                <span style={{ color: C.textDim, marginLeft: 8 }}>· Próximo sync automático en ~12h</span>
              </p>

              <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
                facilito escanea tu Gmail en segundo plano cada 12 horas buscando XMLs del SRI y los guarda automáticamente. También puedes sincronizar ahora manualmente.
              </p>

              {/* Spinner mientras sincroniza */}
              {estado === "syncing" && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ color: C.textMid, fontSize: 12, marginBottom: 8 }}>Buscando facturas en Gmail...</p>
                  <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: C.yellow, borderRadius: 3, width: "60%", animation: "pulse 1.5s ease-in-out infinite" }} />
                  </div>
                </div>
              )}

              {/* Resultado éxito */}
              {estado === "success" && resultado && (
                <div style={{ background: C.greenAccent + "15", border: `1px solid ${C.greenAccent}30`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                  <p style={{ color: C.greenAccent, fontSize: 13, fontWeight: 700 }}>
                    ✓ {resultado.nuevas} facturas nuevas guardadas
                  </p>
                  {resultado.duplicadas > 0 && (
                    <p style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>{resultado.duplicadas} ya existían (omitidas)</p>
                  )}
                  {resultado.errores > 0 && (
                    <p style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{resultado.errores} emails no pudieron procesarse</p>
                  )}
                </div>
              )}

              {/* Error */}
              {estado === "error" && resultado && (
                <div style={{ background: C.red + "15", border: `1px solid ${C.red}30`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                  <p style={{ color: C.red, fontSize: 13, fontWeight: 700 }}>⚠️ {resultado.mensaje}</p>
                  <p style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>
                    Es posible que necesites volver a iniciar sesión para renovar el acceso a Gmail
                  </p>
                </div>
              )}

              {/* Botón sync manual */}
              <button
                onClick={handleSync}
                disabled={estado === "syncing"}
                style={{
                  padding: "11px 24px",
                  background: estado === "syncing" ? C.border : C.yellow,
                  color: estado === "syncing" ? C.textDim : C.green,
                  border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800,
                  cursor: estado === "syncing" ? "not-allowed" : "pointer",
                  fontFamily: "DM Sans, sans-serif",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{ display: "inline-block", animation: estado === "syncing" ? "spin 1s linear infinite" : "none" }}>🔄</span>
                {estado === "syncing" ? "Sincronizando..." : "Sincronizar ahora"}
              </button>
            </div>
          </div>
        </div>

        {/* Categorización info */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px" }}>
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🤖 Categorización automática</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              ["🛒 Alimentación", "Supermaxi, Tía, Coral, restaurantes"],
              ["💊 Salud", "Farmacias, clínicas, hospitales"],
              ["📚 Educación", "Colegios, universidades, librerías"],
              ["👕 Vestimenta", "De Prati, Etafashion, Zara"],
              ["🏠 Vivienda", "Arrendamientos, inmobiliarias"],
              ["✈️ Turismo", "Hoteles, aerolíneas, agencias"],
              ["⛽ Transporte", "Shell, Primax, Uber, taxis"],
              ["📱 Servicios", "Claro, Movistar, Netflix, CNT"],
            ].map(([cat, ejemplos]) => (
              <div key={cat} style={{ padding: "10px 12px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <p style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{cat}</p>
                <p style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{ejemplos}</p>
              </div>
            ))}
          </div>
          <p style={{ color: C.textDim, fontSize: 11, marginTop: 12 }}>Puedes editar la categoría de cualquier factura en la pantalla de Facturas</p>
        </div>

        {/* Outlook coming soon */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px", opacity: 0.5 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#E3F2FD20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>📬</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <p style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>Outlook / Hotmail</p>
                <Badge color={C.yellow}>Próximamente</Badge>
              </div>
              <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Importación desde Microsoft Outlook</p>
            </div>
          </div>
        </div>

        {/* Manual XML */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: C.yellowDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>📄</div>
            <div style={{ flex: 1 }}>
              <p style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Subir XML del SRI</p>
              <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>Importa manualmente los archivos XML descargados del portal del SRI.</p>
              <button style={{ padding: "11px 24px", background: "transparent", color: C.yellow, border: `2px solid ${C.yellow}40`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
                Seleccionar archivos XML
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Declaracion Screen ───────────────────────────────────────────────────────
function DeclaracionDesktop({ facturas, perfil, updatePerfil, savePerfil, syncStatus }) {
  const [tab, setTab] = useState("perfil");
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const catTotals = {};
  facturas.filter(f => f.sri).forEach(f => { catTotals[f.categoria] = (catTotals[f.categoria] || 0) + f.monto; });
  const totalDeducible = Object.values(catTotals).reduce((a, b) => a + b, 0);
  const salarioAnual = parseFloat(perfil.salario || 0) * 12;
  const cargas = parseInt(perfil.cargas || 0);
  const rebaja = salarioAnual > 0 ? calcRebaja(totalDeducible, salarioAnual, cargas) : totalDeducible * 0.10;
  const limite = calcLimite(salarioAnual, cargas);
  const perfilValido = perfil.cedula && perfil.nombre && perfil.salario;

  const handleGenerateGP = () => {
    setGenerating(true);
    setTimeout(() => {
      generarFormularioGP({ perfil, facturas, rebaja, salarioAnual, cargas });
      setGenerating(false);
      setGenerated(true);
    }, 800);
  };

  const handleGenerateAnexo = () => {
    setGenerating(true);
    setTimeout(() => {
      generarAnexoGSP({ perfil, facturas });
      setGenerating(false);
      setGenerated(true);
    }, 800);
  };

  const handleGenerateAmbos = () => {
    setGenerating(true);
    setTimeout(() => {
      generarFormularioGP({ perfil, facturas, rebaja, salarioAnual, cargas });
      generarAnexoGSP({ perfil, facturas });
      setGenerating(false);
      setGenerated(true);
    }, 800);
  };

  const inputStyle = { width: "100%", padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, outline: "none", fontFamily: "DM Sans, sans-serif" };
  const labelStyle = { color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, display: "block" };

  return (
    <div style={{ padding: "32px", overflowY: "auto", flex: 1 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Tu declaración</h1>
        <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Genera tu Formulario GP y Anexo de Gastos Personales</p>
      </div>

      {/* Rebaja card */}
      <div style={{ background: `linear-gradient(135deg, ${C.greenMid}, ${C.green})`, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 }}>Rebaja estimada de IR 2025</p>
          <p style={{ color: C.yellow, fontSize: 36, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{fmt(rebaja)}</p>
          {limite > 0 && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>Límite deducible: {fmt(limite)} · Efectivo: {fmt(Math.min(totalDeducible, limite))}</p>}
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Total gastos SRI</p>
          <p style={{ color: C.text, fontSize: 20, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{fmt(totalDeducible)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: C.surface, padding: 4, borderRadius: 12, width: "fit-content", border: `1px solid ${C.border}` }}>
        {[{ id: "perfil", label: "👤 Perfil" }, { id: "gp", label: "📋 Formulario GP" }, { id: "anexo", label: "📄 Anexo GSP" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: tab === t.id ? C.yellow : "transparent", color: tab === t.id ? C.green : C.textMid, transition: "all 0.15s", fontFamily: "DM Sans, sans-serif" }}>{t.label}</button>
        ))}
      </div>

      {/* ── Perfil tab ── */}
      {tab === "perfil" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 800 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Datos personales</p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Cédula o Pasaporte</label>
              <input value={perfil.cedula || ""} onChange={e => updatePerfil("cedula", e.target.value)} placeholder="1700000000" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Apellidos y Nombres Completos</label>
              <input value={perfil.nombre || ""} onChange={e => updatePerfil("nombre", e.target.value)} placeholder="García Pérez Tomás" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Salario mensual (USD)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textMid, fontSize: 13 }}>$</span>
                <input type="number" value={perfil.salario || ""} onChange={e => updatePerfil("salario", e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: 28 }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Ingresos con otros empleadores (mensual)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textMid, fontSize: 13 }}>$</span>
                <input type="number" value={perfil.otrosIngresos || ""} onChange={e => updatePerfil("otrosIngresos", e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: 28 }} />
              </div>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Cargas y condiciones</p>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Número de cargas familiares</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["0","1","2","3","4","5+"].map(n => (
                  <button key={n} onClick={() => updatePerfil("cargas", n === "5+" ? "5" : n)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${perfil.cargas === (n === "5+" ? "5" : n) ? C.yellow : C.border}`, background: perfil.cargas === (n === "5+" ? "5" : n) ? C.yellowDim : "transparent", color: perfil.cargas === (n === "5+" ? "5" : n) ? C.yellow : C.textMid, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 20 }}>
              <div>
                <p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Enfermedad catastrófica</p>
                <p style={{ color: C.textDim, fontSize: 11 }}>Persona o carga familiar</p>
              </div>
              <button onClick={() => updatePerfil("enfermedadCatastrofica", !perfil.enfermedadCatastrofica)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: perfil.enfermedadCatastrofica ? C.greenAccent : C.border, position: "relative", transition: "all 0.2s" }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: C.white, position: "absolute", top: 3, left: perfil.enfermedadCatastrofica ? 23 : 3, transition: "all 0.2s" }} />
              </button>
            </div>

            {salarioAnual > 0 && (
              <div style={{ background: C.greenAccent + "10", border: `1px solid ${C.greenAccent}30`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
                <p style={{ color: C.greenAccent, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📊 Resumen de cálculo</p>
                {[
                  ["Salario anual", fmt(salarioAnual)],
                  [`Límite deducible (${cargas} cargas)`, fmt(limite)],
                  ["Total gastos SRI", fmt(totalDeducible)],
                  ["Rebaja IR estimada", fmt(rebaja)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: C.textMid, fontSize: 12 }}>{k}</span>
                    <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {syncStatus === "error" && (
              <div style={{ background: "#E0525215", border: `1px solid ${C.red}40`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                <p style={{ color: C.red, fontSize: 12, fontWeight: 600 }}>⚠️ Sin conexión – intenta de nuevo — conéctate para guardar</p>
              </div>
            )}
            <button onClick={() => savePerfil(perfil)} disabled={syncStatus === "saving"} style={{ width: "100%", padding: "12px", background: syncStatus === "saved" ? C.greenAccent : C.yellow, color: C.green, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
              {syncStatus === "saving" ? "Guardando..." : syncStatus === "saved" ? "✓ Guardado" : "💾 Guardar perfil"}
            </button>
          </div>
        </div>
      )}

      {/* ── GP tab ── */}
      {tab === "gp" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 900 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
              <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Ingresos proyectados</p>
            </div>
            {[
              ["103", "Ingresos con empleador", fmt(salarioAnual)],
              ["104", "Otros empleadores", fmt(parseFloat(perfil.otrosIngresos || 0) * 12)],
              ["105", "Total ingresos", fmt(salarioAnual + parseFloat(perfil.otrosIngresos || 0) * 12)],
            ].map(([cod, label, val], i, arr) => (
              <div key={cod} style={{ display: "flex", justifyContent: "space-between", padding: "13px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, background: C.surface, color: C.textDim, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{cod}</span>
                  <span style={{ color: C.textMid, fontSize: 13 }}>{label}</span>
                </div>
                <span style={{ color: i === 2 ? C.yellow : C.text, fontSize: 13, fontWeight: i === 2 ? 800 : 600 }}>{val}</span>
              </div>
            ))}
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
              <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Gastos proyectados (anual)</p>
            </div>
            {Object.entries(CAT_SRI).map(([cat, { field }], i, arr) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "11px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, background: (catColors[cat] || "#ccc") + "20", color: catColors[cat] || "#ccc", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{field}</span>
                  <span style={{ color: C.textMid, fontSize: 12 }}>{cat}</span>
                </div>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{fmt((catTotals[cat] || 0) * 12)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 20px", background: C.greenMid }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>112 · Total gastos proyectados</span>
              <span style={{ color: C.yellow, fontSize: 14, fontWeight: 800 }}>{fmt(totalDeducible * 12)}</span>
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px", gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
              {[
                ["113", "Discapacidad / Enf. catastrófica", perfil.enfermedadCatastrofica ? "SÍ" : "NO"],
                ["114", "Cargas familiares", perfil.cargas || "0"],
                ["115", "Rebaja IR por gastos personales", fmt(rebaja)],
              ].map(([cod, label, val]) => (
                <div key={cod} style={{ flex: 1, padding: "14px 16px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, background: C.border, color: C.textDim, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{cod}</span>
                    <span style={{ color: C.textDim, fontSize: 11 }}>{label}</span>
                  </div>
                  <span style={{ color: cod === "115" ? C.yellow : C.text, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{val}</span>
                </div>
              ))}
            </div>

            {!generated ? (
              <button onClick={handleGenerateGP} disabled={!perfilValido || generating} style={{ padding: "13px 28px", background: perfilValido ? C.yellow : C.border, color: perfilValido ? C.green : C.textDim, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: perfilValido ? "pointer" : "not-allowed", fontFamily: "DM Sans, sans-serif" }}>
                {generating ? "Generando..." : "⬇️ Generar y Descargar Formulario GP (.xlsx)"}
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 14, background: C.greenAccent + "15", border: `1px solid ${C.greenAccent}30`, borderRadius: 12, padding: "14px 18px" }}>
                <span style={{ fontSize: 24 }}>📊</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: C.greenAccent, fontSize: 13, fontWeight: 700 }}>Formulario_GP_{new Date().getFullYear()}.xlsx descargado</p>
                  <p style={{ color: C.textDim, fontSize: 11 }}>Archivo Excel con formato oficial SRI · {new Date().toLocaleDateString("es-EC")}</p>
                </div>
                <button onClick={handleGenerateGP} style={{ padding: "10px 20px", background: C.yellow, color: C.green, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>⬇️ Descargar de nuevo</button>
                <button onClick={() => setGenerated(false)} style={{ padding: "10px 16px", background: "transparent", color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>Regenerar</button>
              </div>
            )}
            {!perfilValido && <p style={{ color: C.textDim, fontSize: 12, marginTop: 8 }}>Completa tu perfil primero</p>}
          </div>
        </div>
      )}

      {/* ── Anexo tab ── */}
      {tab === "anexo" && (
        <div style={{ maxWidth: 900 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface, display: "flex", justifyContent: "space-between" }}>
              <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Detalle por proveedor</p>
              <p style={{ color: C.textDim, fontSize: 12 }}>Hoja 1: Detalle Gastos con Proveedor</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "10px 20px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
              {["RUC Proveedor", "Comprobantes", "Base Imponible", "Tipo de Gasto"].map(h => (
                <p key={h} style={{ color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</p>
              ))}
            </div>
            {facturas.filter(f => f.sri).map((f, i, arr) => (
              <div key={f.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "12px 20px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "center" }}>
                <div>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{f.emisor}</p>
                  <p style={{ color: C.textDim, fontSize: 11 }}>{f.ruc}</p>
                </div>
                <p style={{ color: C.textMid, fontSize: 13 }}>{f.comprobantes}</p>
                <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{fmt(f.monto)}</p>
                <Badge color={catColors[f.categoria] || "#ccc"}>{f.categoria.toUpperCase()}</Badge>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "13px 20px", background: C.greenMid }}>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600, gridColumn: "1/3" }}>Total gastos deducibles</p>
              <p style={{ color: C.yellow, fontSize: 14, fontWeight: 800 }}>{fmt(facturas.filter(f => f.sri).reduce((a, b) => a + b.monto, 0))}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={handleGenerateAnexo} disabled={!perfilValido || generating} style={{ padding: "12px 24px", background: perfilValido ? C.yellow : C.border, color: perfilValido ? C.green : C.textDim, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: perfilValido ? "pointer" : "not-allowed", fontFamily: "DM Sans, sans-serif" }}>
              {generating ? "Generando..." : "⬇️ Generar Anexo GSP (.xlsx)"}
            </button>
            <button onClick={handleGenerateAmbos} disabled={!perfilValido || generating} style={{ padding: "12px 24px", background: "transparent", color: C.yellow, border: `2px solid ${C.yellow}40`, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: perfilValido ? "pointer" : "not-allowed", fontFamily: "DM Sans, sans-serif" }}>
              ⬇️ Generar ambos formularios
            </button>
          </div>
          {!perfilValido && <p style={{ color: C.textDim, fontSize: 12, marginTop: 8 }}>Completa tu perfil primero</p>}
        </div>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function LemonTaxDesktop() {
  const { user, logout } = useAuth();
  const [screen, setScreen] = useState("dashboard");
  const [facturas, setFacturas] = useState([]);
  const [perfil, setPerfil] = useState({ cedula: "", nombre: "", salario: "", otrosIngresos: "", cargas: "0", enfermedadCatastrofica: false });
  const [syncStatus, setSyncStatus] = useState("idle");
  const [appLoading, setAppLoading] = useState(true);

  // Cargar datos del usuario desde Supabase al iniciar
  useEffect(() => {
    if (!user) return;
    async function loadData() {
      setAppLoading(true);
      try {
        const [{ data: facturasData }, { data: perfilData }] = await Promise.all([
          supabase.from("facturas").select("*").eq("user_id", user.id).order("fecha", { ascending: false }),
          supabase.from("perfil").select("*").eq("user_id", user.id).maybeSingle(),
        ]);
        if (facturasData?.length > 0) {
          setFacturas(facturasData.map(f => ({
            id: f.id, emisor: f.emisor, ruc: f.ruc || "", fecha: f.fecha,
            monto: f.monto, categoria: f.categoria, sri: f.es_deducible_sri,
            comprobantes: f.comprobantes || 1, fuente: f.fuente || "manual",
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
        console.error("Error cargando datos:", e);
      }
      setAppLoading(false);
    }
    loadData();
  }, [user]);

  const updatePerfil = (k, v) => setPerfil(prev => ({ ...prev, [k]: v }));

  const savePerfil = async (p) => {
    if (!navigator.onLine) { setSyncStatus("error"); return; }
    setSyncStatus("saving");
    try {
      const payload = {
        user_id: user.id,
        cedula: p.cedula,
        nombre: p.nombre,
        salario_mensual: parseFloat(p.salario) || 0,
        otros_ingresos: parseFloat(p.otrosIngresos) || 0,
        cargas_familiares: parseInt(p.cargas) || 0,
        enfermedad_catastrofica: p.enfermedadCatastrofica || false,
      };
      if (p._id) {
        await supabase.from("perfil").update(payload).eq("id", p._id);
      } else {
        const { data } = await supabase.from("perfil").insert(payload).select().single();
        if (data) setPerfil(prev => ({ ...prev, _id: data.id }));
      }
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch (e) {
      setSyncStatus("error");
    }
  };

  // Guardar facturas importadas en Supabase
  const saveFacturas = async (nuevasFacturas) => {
    if (!user || nuevasFacturas.length === 0) return;
    setSyncStatus("saving");
    try {
      const payload = nuevasFacturas.map(f => ({
        user_id: user.id,
        emisor: f.emisor,
        ruc: f.ruc,
        fecha: f.fecha,
        monto: f.monto,
        categoria: f.categoria,
        es_deducible_sri: f.sri,
        comprobantes: f.comprobantes || 1,
        fuente: f.fuente || "gmail",
      }));
      await supabase.from("facturas").upsert(payload, { onConflict: "user_id,ruc,fecha,monto" });
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch (e) {
      console.error("Error guardando facturas:", e);
      setSyncStatus("error");
    }
  };

  // Nombre e inicial del usuario
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario";
  const userAvatar = user?.user_metadata?.avatar_url;
  const initiales = userName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  if (appLoading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#0D1F14", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 48 }}>✓</span>
      <p style={{ color: "#F5E642", fontSize: 20, fontWeight: 800, fontFamily: "sans-serif" }}>Cargando...</p>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, fontFamily: "'DM Sans', sans-serif", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #243B2A; border-radius: 2px; }
        input { caret-color: #F5E642; } input::placeholder { color: #4A6350; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        button:hover { opacity: 0.88; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Sidebar con datos reales del usuario */}
      <div style={{ width: 220, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "28px 24px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="30" height="30" viewBox="0 0 56 56" fill="none">
              <rect width="56" height="56" rx="14" fill="#F5E642"/>
              <path d="M14 28.5L23.5 38L42 19" stroke="#1A3A2A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <p style={{ color: C.yellow, fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>facilito</p>
              <p style={{ color: C.textDim, fontSize: 10, marginTop: 2 }}>tus impuestos, facilito</p>
            </div>
          </div>
        </div>
        <nav style={{ padding: "8px 12px", flex: 1 }}>
          {[
            { id: "dashboard", icon: "home", label: "Inicio" },
            { id: "facturas", icon: "receipt", label: "Facturas" },
            { id: "declaracion", icon: "check_circle", label: "Tu declaración" },
            { id: "conectar", icon: "sync", label: "Sincronizar" },
          ].map(item => {
            const active = screen === item.id;
            return (
              <button key={item.id} onClick={() => setScreen(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: active ? C.yellowDim : "transparent", marginBottom: 4, transition: "all 0.15s", textAlign: "left" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
              {item.icon === "home"         && <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill={active ? C.yellow : C.textDim}/>}
              {item.icon === "receipt"      && <path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5z" fill={active ? C.yellow : C.textDim}/>}
              {item.icon === "check_circle" && <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill={active ? C.yellow : C.textDim}/>}
              {item.icon === "sync"         && <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill={active ? C.yellow : C.textDim}/>}
            </svg>
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.yellow : C.textMid, fontFamily: "DM Sans, sans-serif" }}>{item.label}</span>
                {active && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: 2, background: C.yellow }} />}
              </button>
            );
          })}
        </nav>
        {/* User info + logout */}
        <div style={{ padding: "16px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {userAvatar ? (
              <img src={userAvatar} style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover" }} alt="avatar" />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: 10, background: C.yellow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: C.green, fontFamily: "Syne, sans-serif" }}>{initiales}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: C.text, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</p>
              <p style={{ color: C.textDim, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</p>
            </div>
          </div>
          <button onClick={logout} style={{ width: "100%", padding: "8px", background: "transparent", color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <p style={{ color: C.textDim, fontSize: 12 }}>
            {new Date().toLocaleDateString("es-EC", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {syncStatus === "saving" && <span style={{ color: C.yellow, fontSize: 12 }}>↻ Guardando...</span>}
            {syncStatus === "saved" && <span style={{ color: C.greenAccent, fontSize: 12 }}>Todo listo ✓</span>}
            {syncStatus === "error" && <span style={{ color: C.red, fontSize: 12 }}>Sin conexión – intenta de nuevo</span>}
            <div style={{ width: 8, height: 8, borderRadius: 4, background: C.greenAccent }} />
            <span style={{ color: C.textMid, fontSize: 12 }}>Todo bien ✓</span>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {screen === "dashboard" && <InicioDesktop facturas={facturas} perfil={perfil} navigate={setScreen} />}
          {screen === "facturas" && <FacturasDesktop facturas={facturas} setFacturas={setFacturas} />}
          {screen === "conectar" && <ConectarDesktop facturas={facturas} setFacturas={setFacturas} setSyncStatus={setSyncStatus} saveFacturas={saveFacturas} />}
          {screen === "declaracion" && <DeclaracionDesktop facturas={facturas} perfil={perfil} updatePerfil={updatePerfil} savePerfil={savePerfil} syncStatus={syncStatus} />}
        </div>
      </div>
    </div>
  );
}
