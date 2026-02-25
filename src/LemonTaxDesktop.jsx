import { useState, useEffect } from "react";
import { generarFormularioGP, generarAnexoGSP } from "./sriExport";
import { useAuth } from "./auth.jsx";
import { supabase } from "./supabase";

// ─── Design tokens (light mode) ─────────────────────────────────────────────
const C = {
  bg: "#FFFFFF",
  surface: "#F7FAF8",
  card: "#FFFFFF",
  cardDark: "#1A3A2A",
  border: "#E0E8E2",
  green: "#1A3A2A",
  greenMid: "#2D5A3D",
  greenAccent: "#4CAF82",
  yellow: "#F5E642",
  yellowDim: "#F5E64220",
  white: "#FFFFFF",
  text: "#1A2E20",
  textMid: "#5A7A64",
  textDim: "#8FA894",
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
  "Alimentación": "shopping_cart", "Salud": "medication", "Educación": "school",
  "Vivienda": "home", "Vestimenta": "checkroom", "Turismo": "flight",
  "Transporte": "local_gas_station", "Servicios": "phone_iphone", "Entretenimiento": "movie", "Otros": "receipt_long",
};

const CAT_SRI = {
  "Vivienda": { field: 106 }, "Educación": { field: 107 },
  "Salud": { field: 108 }, "Vestimenta": { field: 109 },
  "Alimentación": { field: 110 }, "Turismo": { field: 111 },
};

const CANASTA = 821.80;

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

function generarJSONSRI({ catTotals }) {
  const año = new Date().getFullYear() - 1;
  const CONCEPTOS = {
    "Vivienda": "3310", "Educación": "5040", "Salud": "3290",
    "Vestimenta": "3320", "Alimentación": "3300", "Turismo": "3325",
  };
  const detalles = {};
  let total = 0;
  for (const [cat, concepto] of Object.entries(CONCEPTOS)) {
    const anual = (catTotals[cat] || 0) * 12;
    if (anual > 0) {
      detalles[concepto] = String(parseFloat(anual.toFixed(2)));
      total += anual;
    }
  }
  if (total > 0) detalles["3330"] = String(parseFloat(total.toFixed(2)));
  const json = { detallesDeclaracion: detalles };
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `facilito_gastos_${año}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Material Icon helper ─────────────────────────────────────────────────────
function Icon({ name, color, size = 20, style: extra }) {
  return <span className="material-symbols-outlined" style={{ fontSize: size, color: color || C.green, verticalAlign: "middle", lineHeight: 1, ...extra }}>{name}</span>;
}

// ─── Micro components ─────────────────────────────────────────────────────────
function Badge({ children, color }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: color + "20", color }}>{children}</span>;
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div style={{ background: C.cardDark, borderRadius: 16, padding: "20px 24px", flex: 1, boxShadow: "0 2px 12px rgba(26,58,42,0.12)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{label}</p>
          <p style={{ color: accent || C.yellow, fontSize: 28, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6 }}>{sub}</p>}
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} color={accent || C.yellow} size={22} />
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
  const catTotals = {};
  facturas.filter(f => f.sri).forEach(f => { catTotals[f.categoria] = (catTotals[f.categoria] || 0) + f.monto; });
  const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ padding: "32px", overflowY: "auto", flex: 1 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Inicio</h1>
        <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Todo bien, estás al día · 2025</p>
      </div>

      {!perfil.salario && (
        <div onClick={() => navigate("declaracion")} style={{ background: C.yellowDim, border: `1px solid ${C.yellow}40`, borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <Icon name="warning" color={C.green} size={22} />
          <div style={{ flex: 1 }}>
            <p style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>Agrega tu salario para ver tu rebaja exacta</p>
            <p style={{ color: C.textMid, fontSize: 12 }}>Toca aquí para completar tu declaración →</p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <StatCard icon="savings" label="Rebaja estimada IR" value={fmt(rebaja)} sub="Basado en gastos deducibles" accent={C.yellow} />
        <StatCard icon="receipt" label="Total gastos" value={fmt(total)} sub={`${facturas.length} facturas registradas`} accent={C.greenAccent} />
        <StatCard icon="check_circle" label="Gastos deducibles" value={fmt(deducible)} sub={`Límite: ${fmt(limite)}`} accent={C.blue} />
        <StatCard icon="bar_chart" label="% del límite usado" value={limite > 0 ? `${Math.min(Math.round(deducible / limite * 100), 100)}%` : "—"} sub="Capacidad de deducción" accent={C.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Facturas recientes</p>
            <button onClick={() => navigate("facturas")} style={{ color: C.greenAccent, fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Ver todas →</button>
          </div>
          {facturas.slice(0, 6).map((f, i) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", padding: "12px 20px", borderBottom: i < 5 ? `1px solid ${C.border}` : "none", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: (catColors[f.categoria] || "#ccc") + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={catIcons[f.categoria] || "receipt_long"} color={catColors[f.categoria] || "#ccc"} size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{f.emisor}</p>
                <p style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{f.fecha} · {f.categoria}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{fmt(f.monto)}</p>
                {f.sri && <Badge color={C.greenAccent}>SRI <Icon name="check" color={C.greenAccent} size={11} /></Badge>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Gastos por categoría</p>
            {topCats.map(([cat, monto]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ color: C.textMid, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name={catIcons[cat]} color={catColors[cat]} size={16} />{cat}
                  </span>
                  <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{fmt(monto)}</span>
                </div>
                <div style={{ height: 5, background: C.border, borderRadius: 3 }}>
                  <div style={{ height: "100%", borderRadius: 3, background: catColors[cat] || C.greenAccent, width: `${Math.min((monto / deducible) * 100, 100)}%`, transition: "width 0.6s ease" }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Acciones rápidas</p>
            {[
              { icon: "mail", label: "Importar facturas desde Gmail", action: "conectar" },
              { icon: "receipt_long", label: "Generar Formulario GP", action: "declaracion" },
              { icon: "description", label: "Generar Anexo GSP", action: "declaracion" },
            ].map((a, i) => (
              <button key={i} onClick={() => navigate(a.action)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left", transition: "all 0.15s", marginBottom: 8 }}>
                <Icon name={a.icon} color={C.textMid} size={18} />
                <span style={{ color: C.textMid, fontSize: 12, fontWeight: 500, fontFamily: "DM Sans, sans-serif" }}>{a.label}</span>
                <span style={{ marginLeft: "auto", color: C.textDim, fontSize: 12 }}>→</span>
              </button>
            ))}
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
  const filtered = facturas.filter(f => filter === "Todas" || f.categoria === filter).filter(f => f.emisor.toLowerCase().includes(search.toLowerCase()) || f.ruc.includes(search));
  const total = filtered.reduce((a, b) => a + b.monto, 0);
  const deducible = filtered.filter(f => f.sri).reduce((a, b) => a + b.monto, 0);
  const saveEdit = async (id) => { setFacturas(prev => prev.map(f => f.id === id ? { ...f, categoria: editCat } : f)); setEditingId(null); await supabase.from("facturas").update({ categoria: editCat }).eq("id", id); };

  return (
    <div style={{ padding: "32px", overflowY: "auto", flex: 1 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Facturas</h1>
        <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Gestiona tus comprobantes de gastos personales</p>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[{ label: "Total filtrado", value: fmt(total), color: C.text }, { label: "Deducible SRI", value: fmt(deducible), color: C.greenAccent }, { label: "Facturas", value: filtered.length, color: C.green }].map((s, i) => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 20px", display: "flex", gap: 12, alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <p style={{ color: C.textDim, fontSize: 12 }}>{s.label}</p>
            <p style={{ color: s.color, fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por emisor o RUC..." style={{ padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, outline: "none", width: 260, fontFamily: "DM Sans, sans-serif" }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {cats.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${filter === cat ? C.green : C.border}`, background: filter === cat ? C.green : "transparent", color: filter === cat ? C.white : C.textMid, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "DM Sans, sans-serif", transition: "all 0.15s" }}>{cat}</button>
          ))}
        </div>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 120px 100px 90px 90px 100px", padding: "12px 20px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
          {["Emisor / RUC", "Categoría", "Fecha", "Comprobantes", "Monto", "SRI", "Acción"].map(h => (
            <p key={h} style={{ color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</p>
          ))}
        </div>
        {filtered.map((f, i) => (
          <div key={f.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 120px 100px 90px 90px 100px", padding: "13px 20px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: (catColors[f.categoria] || "#ccc") + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={catIcons[f.categoria] || "receipt_long"} color={catColors[f.categoria] || "#ccc"} size={16} /></div>
              <div><p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{f.emisor}</p><p style={{ color: C.textDim, fontSize: 11 }}>{f.ruc}</p></div>
            </div>
            <div>{editingId === f.id ? <select value={editCat} onChange={e => setEditCat(e.target.value)} style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "DM Sans, sans-serif", outline: "none" }}>{Object.keys(catColors).map(c => <option key={c} value={c}>{c}</option>)}</select> : <Badge color={catColors[f.categoria] || "#ccc"}>{f.categoria}</Badge>}</div>
            <p style={{ color: C.textMid, fontSize: 12 }}>{f.fecha}</p>
            <p style={{ color: C.textMid, fontSize: 12, textAlign: "center" }}>{f.comprobantes}</p>
            <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{fmt(f.monto)}</p>
            <div>{f.sri ? <Badge color={C.greenAccent}>SRI <Icon name="check" color={C.greenAccent} size={11} /></Badge> : <Badge color={C.textDim}>No</Badge>}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {editingId === f.id ? (<><button onClick={() => saveEdit(f.id)} style={{ padding: "4px 8px", background: C.greenAccent + "20", color: C.greenAccent, border: `1px solid ${C.greenAccent}40`, borderRadius: 6, cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontWeight: 700 }}><Icon name="check" color={C.greenAccent} size={14} /></button><button onClick={() => setEditingId(null)} style={{ padding: "4px 8px", background: "transparent", color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer" }}><Icon name="close" color={C.textDim} size={14} /></button></>) : (<button onClick={() => { setEditingId(f.id); setEditCat(f.categoria); }} style={{ fontSize: 11, padding: "4px 10px", background: "transparent", color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontWeight: 600 }}>Editar</button>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Conectar Screen ──────────────────────────────────────────────────────────
function ConectarDesktop({ setSyncStatus }) {
  const { triggerSync } = useAuth();
  const [estado, setEstado] = useState("idle");
  const [resultado, setResultado] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    import("./supabase").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase.from("gmail_tokens").select("last_sync").eq("user_id", user.id).single().then(({ data }) => { if (data?.last_sync) setLastSync(new Date(data.last_sync)); });
      });
    });
  }, []);

  const handleSync = async () => {
    setEstado("syncing"); setResultado(null);
    try {
      const res = await triggerSync();
      const r = res.resultados?.[0];
      setResultado({ nuevas: r?.nuevas ?? 0, duplicadas: r?.duplicadas ?? 0, errores: r?.errores ?? 0 });
      setLastSync(new Date());
      if ((r?.nuevas ?? 0) > 0) { setSyncStatus("saved"); setTimeout(() => setSyncStatus("idle"), 2000); }
      setEstado("success");
    } catch (e) { console.error(e); setEstado("error"); setResultado({ mensaje: e.message || "Error al sincronizar" }); }
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
        {/* Gmail — dark important card */}
        <div style={{ background: C.cardDark, borderRadius: 16, padding: "24px", boxShadow: "0 2px 12px rgba(26,58,42,0.12)" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="mail" color={C.white} size={26} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <p style={{ color: C.white, fontSize: 16, fontWeight: 700 }}>Gmail — Sync automático</p>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: C.greenAccent + "30", color: C.greenAccent }}><Icon name="check" color={C.greenAccent} size={12} /> Conectado</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 12 }}>Último sync: <span style={{ color: "rgba(255,255,255,0.7)" }}>{formatLastSync(lastSync)}</span><span style={{ marginLeft: 8 }}>· Próximo sync automático en ~12h</span></p>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>facilito escanea tu Gmail en segundo plano cada 12 horas buscando XMLs del SRI y los guarda automáticamente.</p>
              {estado === "syncing" && <div style={{ marginBottom: 16 }}><p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 8 }}>Buscando facturas en Gmail...</p><div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", background: C.yellow, borderRadius: 3, width: "60%", animation: "pulse 1.5s ease-in-out infinite" }} /></div></div>}
              {estado === "success" && resultado && <div style={{ background: C.greenAccent + "20", border: `1px solid ${C.greenAccent}40`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}><p style={{ color: C.greenAccent, fontSize: 13, fontWeight: 700 }}><Icon name="check_circle" color={C.greenAccent} size={16} /> {resultado.nuevas} facturas nuevas guardadas</p>{resultado.duplicadas > 0 && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4 }}>{resultado.duplicadas} ya existían</p>}{resultado.errores > 0 && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>{resultado.errores} emails no pudieron procesarse</p>}</div>}
              {estado === "error" && resultado && <div style={{ background: C.red + "20", border: `1px solid ${C.red}40`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}><p style={{ color: C.red, fontSize: 13, fontWeight: 700 }}><Icon name="warning" color={C.red} size={16} /> {resultado.mensaje}</p><p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4 }}>Es posible que necesites volver a iniciar sesión</p></div>}
              <button onClick={handleSync} disabled={estado === "syncing"} style={{ padding: "11px 24px", background: estado === "syncing" ? "rgba(255,255,255,0.1)" : C.yellow, color: estado === "syncing" ? "rgba(255,255,255,0.5)" : C.green, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: estado === "syncing" ? "not-allowed" : "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="sync" color={estado === "syncing" ? "rgba(255,255,255,0.5)" : C.green} size={18} style={{ display: "inline-block", animation: estado === "syncing" ? "spin 1s linear infinite" : "none" }} />
                {estado === "syncing" ? "Sincronizando..." : "Sincronizar ahora"}
              </button>
            </div>
          </div>
        </div>
        {/* Categorización info */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}><Icon name="smart_toy" color={C.greenAccent} size={20} /> Categorización automática</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[["shopping_cart","Alimentación","Supermaxi, Tía, Coral, restaurantes"],["medication","Salud","Farmacias, clínicas, hospitales"],["school","Educación","Colegios, universidades, librerías"],["checkroom","Vestimenta","De Prati, Etafashion, Zara"],["home","Vivienda","Arrendamientos, inmobiliarias"],["flight","Turismo","Hoteles, aerolíneas, agencias"],["local_gas_station","Transporte","Shell, Primax, Uber, taxis"],["phone_iphone","Servicios","Claro, Movistar, Netflix, CNT"]].map(([icon, cat, ej]) => (
              <div key={cat} style={{ padding: "10px 12px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}><p style={{ color: C.text, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Icon name={icon} color={C.textMid} size={16} /> {cat}</p><p style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{ej}</p></div>
            ))}
          </div>
          <p style={{ color: C.textDim, fontSize: 11, marginTop: 12 }}>Puedes editar la categoría de cualquier factura en la pantalla de Facturas</p>
        </div>
        {/* Outlook */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px", opacity: 0.5, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#E3F2FD", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="mark_email_unread" color="#1565C0" size={26} /></div>
            <div style={{ flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between" }}><p style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>Outlook / Hotmail</p><Badge color={C.yellow}>Próximamente</Badge></div><p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Importación desde Microsoft Outlook</p></div>
          </div>
        </div>
        {/* Manual XML */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: C.yellowDim, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="description" color={C.green} size={26} /></div>
            <div style={{ flex: 1 }}><p style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Subir XML del SRI</p><p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>Importa manualmente los archivos XML descargados del portal del SRI.</p><button style={{ padding: "11px 24px", background: "transparent", color: C.green, border: `2px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>Seleccionar archivos XML</button></div>
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
  const handleGenerateGP = () => { setGenerating(true); setTimeout(() => { generarFormularioGP({ perfil, facturas, rebaja, salarioAnual, cargas }); setGenerating(false); setGenerated(true); }, 800); };
  const handleGenerateAnexo = () => { setGenerating(true); setTimeout(() => { generarAnexoGSP({ perfil, facturas }); setGenerating(false); setGenerated(true); }, 800); };
  const handleGenerateAmbos = () => { setGenerating(true); setTimeout(() => { generarFormularioGP({ perfil, facturas, rebaja, salarioAnual, cargas }); generarAnexoGSP({ perfil, facturas }); setGenerating(false); setGenerated(true); }, 800); };
  const inputStyle = { width: "100%", padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, outline: "none", fontFamily: "DM Sans, sans-serif" };
  const labelStyle = { color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, display: "block" };

  return (
    <div style={{ padding: "32px", overflowY: "auto", flex: 1 }}>
      <div style={{ marginBottom: 24 }}><h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Tu declaración</h1><p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Genera tu Formulario GP y Anexo de Gastos Personales</p></div>
      {/* Rebaja dark card */}
      <div style={{ background: `linear-gradient(135deg, ${C.greenMid}, ${C.green})`, borderRadius: 16, padding: "20px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 12px rgba(26,58,42,0.15)" }}>
        <div><p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 4 }}>Rebaja estimada de IR 2025</p><p style={{ color: C.yellow, fontSize: 36, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{fmt(rebaja)}</p>{limite > 0 && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>Límite: {fmt(limite)} · Efectivo: {fmt(Math.min(totalDeducible, limite))}</p>}</div>
        <div style={{ textAlign: "right" }}><p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>Total gastos SRI</p><p style={{ color: C.white, fontSize: 20, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{fmt(totalDeducible)}</p></div>
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: C.surface, padding: 4, borderRadius: 12, width: "fit-content", border: `1px solid ${C.border}` }}>
        {[{ id: "perfil", icon: "person", label: "Perfil" }, { id: "gp", icon: "receipt_long", label: "Formulario GP" }, { id: "anexo", icon: "description", label: "Anexo GSP" }, { id: "guia", icon: "menu_book", label: "Cómo declarar" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: tab === t.id ? C.green : "transparent", color: tab === t.id ? C.white : C.textMid, transition: "all 0.15s", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6 }}><Icon name={t.icon} color={tab === t.id ? C.white : C.textMid} size={16} /> {t.label}</button>
        ))}
      </div>

      {tab === "perfil" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 800 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Datos personales</p>
            <div style={{ marginBottom: 16 }}><label style={labelStyle}>Cédula o Pasaporte</label><input value={perfil.cedula || ""} onChange={e => updatePerfil("cedula", e.target.value)} placeholder="1700000000" style={inputStyle} /></div>
            <div style={{ marginBottom: 16 }}><label style={labelStyle}>Apellidos y Nombres Completos</label><input value={perfil.nombre || ""} onChange={e => updatePerfil("nombre", e.target.value)} placeholder="García Pérez Tomás" style={inputStyle} /></div>
            <div style={{ marginBottom: 16 }}><label style={labelStyle}>Salario mensual (USD)</label><div style={{ position: "relative" }}><span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textMid, fontSize: 13 }}>$</span><input type="number" value={perfil.salario || ""} onChange={e => updatePerfil("salario", e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: 28 }} /></div></div>
            <div><label style={labelStyle}>Ingresos con otros empleadores (mensual)</label><div style={{ position: "relative" }}><span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textMid, fontSize: 13 }}>$</span><input type="number" value={perfil.otrosIngresos || ""} onChange={e => updatePerfil("otrosIngresos", e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: 28 }} /></div></div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Cargas y condiciones</p>
            <div style={{ marginBottom: 20 }}><label style={labelStyle}>Número de cargas familiares</label><div style={{ display: "flex", gap: 8 }}>{["0","1","2","3","4","5+"].map(n => (<button key={n} onClick={() => updatePerfil("cargas", n === "5+" ? "5" : n)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${perfil.cargas === (n === "5+" ? "5" : n) ? C.green : C.border}`, background: perfil.cargas === (n === "5+" ? "5" : n) ? C.green : "transparent", color: perfil.cargas === (n === "5+" ? "5" : n) ? C.white : C.textMid, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>{n}</button>))}</div></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 20 }}><div><p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Enfermedad catastrófica</p><p style={{ color: C.textDim, fontSize: 11 }}>Persona o carga familiar</p></div><button onClick={() => updatePerfil("enfermedadCatastrofica", !perfil.enfermedadCatastrofica)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: perfil.enfermedadCatastrofica ? C.greenAccent : C.border, position: "relative", transition: "all 0.2s" }}><div style={{ width: 18, height: 18, borderRadius: 9, background: C.white, position: "absolute", top: 3, left: perfil.enfermedadCatastrofica ? 23 : 3, transition: "all 0.2s" }} /></button></div>
            {salarioAnual > 0 && <div style={{ background: C.greenAccent + "10", border: `1px solid ${C.greenAccent}30`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}><p style={{ color: C.greenAccent, fontSize: 12, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Icon name="bar_chart" color={C.greenAccent} size={16} /> Resumen de cálculo</p>{[["Salario anual", fmt(salarioAnual)],[`Límite deducible (${cargas} cargas)`, fmt(limite)],["Total gastos SRI", fmt(totalDeducible)],["Rebaja IR estimada", fmt(rebaja)]].map(([k, v]) => (<div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: C.textMid, fontSize: 12 }}>{k}</span><span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{v}</span></div>))}</div>}
            {syncStatus === "error" && <div style={{ background: C.red + "10", border: `1px solid ${C.red}30`, borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}><p style={{ color: C.red, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Icon name="warning" color={C.red} size={16} /> Sin conexión</p></div>}
            <button onClick={() => savePerfil(perfil)} disabled={syncStatus === "saving"} style={{ width: "100%", padding: "12px", background: syncStatus === "saved" ? C.greenAccent : C.green, color: C.white, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{syncStatus === "saving" ? "Guardando..." : syncStatus === "saved" ? <><Icon name="check_circle" color={C.white} size={18} /> Guardado</> : <><Icon name="save" color={C.white} size={18} /> Guardar perfil</>}</button>
          </div>
        </div>
      )}

      {tab === "gp" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 900 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}><div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface }}><p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Ingresos proyectados</p></div>{[["103","Ingresos con empleador",fmt(salarioAnual)],["104","Otros empleadores",fmt(parseFloat(perfil.otrosIngresos||0)*12)],["105","Total ingresos",fmt(salarioAnual+parseFloat(perfil.otrosIngresos||0)*12)]].map(([cod,label,val],i,arr)=>(<div key={cod} style={{display:"flex",justifyContent:"space-between",padding:"13px 20px",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:10,background:C.surface,color:C.textDim,padding:"2px 6px",borderRadius:4,fontWeight:700}}>{cod}</span><span style={{color:C.textMid,fontSize:13}}>{label}</span></div><span style={{color:i===2?C.green:C.text,fontSize:13,fontWeight:i===2?800:600}}>{val}</span></div>))}</div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}><div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface }}><p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Gastos proyectados (anual)</p></div>{Object.entries(CAT_SRI).map(([cat,{field}],i,arr)=>(<div key={cat} style={{display:"flex",justifyContent:"space-between",padding:"11px 20px",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:10,background:(catColors[cat]||"#ccc")+"15",color:catColors[cat]||"#ccc",padding:"2px 6px",borderRadius:4,fontWeight:700}}>{field}</span><span style={{color:C.textMid,fontSize:12}}>{cat}</span></div><span style={{color:C.text,fontSize:13,fontWeight:600}}>{fmt((catTotals[cat]||0)*12)}</span></div>))}<div style={{display:"flex",justifyContent:"space-between",padding:"13px 20px",background:C.greenMid}}><span style={{color:"rgba(255,255,255,0.7)",fontSize:13,fontWeight:600}}>112 · Total gastos proyectados</span><span style={{color:C.yellow,fontSize:14,fontWeight:800}}>{fmt(totalDeducible*12)}</span></div></div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px", gridColumn: "1 / -1", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>{[["113","Discapacidad / Enf. catastrófica",perfil.enfermedadCatastrofica?"SÍ":"NO"],["114","Cargas familiares",perfil.cargas||"0"],["115","Rebaja IR por gastos personales",fmt(rebaja)]].map(([cod,label,val])=>(<div key={cod} style={{flex:1,padding:"14px 16px",background:C.surface,borderRadius:10,border:`1px solid ${C.border}`}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><span style={{fontSize:10,background:C.border,color:C.textDim,padding:"2px 6px",borderRadius:4,fontWeight:700}}>{cod}</span><span style={{color:C.textDim,fontSize:11}}>{label}</span></div><span style={{color:cod==="115"?C.greenAccent:C.text,fontSize:18,fontWeight:800,fontFamily:"Syne, sans-serif"}}>{val}</span></div>))}</div>
            {!generated ? <button onClick={handleGenerateGP} disabled={!perfilValido||generating} style={{padding:"13px 28px",background:perfilValido?C.green:C.border,color:perfilValido?C.white:C.textDim,border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:perfilValido?"pointer":"not-allowed",fontFamily:"DM Sans, sans-serif",display:"flex",alignItems:"center",gap:8}}><Icon name="download" color={perfilValido?C.white:C.textDim} size={18} />{generating?"Generando...":"Generar y Descargar Formulario GP (.xlsx)"}</button> : <div style={{display:"flex",alignItems:"center",gap:14,background:C.greenAccent+"10",border:`1px solid ${C.greenAccent}30`,borderRadius:12,padding:"14px 18px"}}><Icon name="bar_chart" color={C.greenAccent} size={28} /><div style={{flex:1}}><p style={{color:C.greenAccent,fontSize:13,fontWeight:700}}>Formulario_GP_{new Date().getFullYear()}.xlsx descargado</p><p style={{color:C.textDim,fontSize:11}}>Archivo Excel con formato oficial SRI · {new Date().toLocaleDateString("es-EC")}</p></div><button onClick={handleGenerateGP} style={{padding:"10px 20px",background:C.green,color:C.white,border:"none",borderRadius:8,fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"DM Sans, sans-serif",display:"flex",alignItems:"center",gap:6}}><Icon name="download" color={C.white} size={16} /> Descargar</button><button onClick={()=>setGenerated(false)} style={{padding:"10px 16px",background:"transparent",color:C.textMid,border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,cursor:"pointer",fontFamily:"DM Sans, sans-serif"}}>Regenerar</button></div>}
            {!perfilValido && <p style={{ color: C.textDim, fontSize: 12, marginTop: 8 }}>Completa tu perfil primero</p>}
          </div>
        </div>
      )}

      {tab === "anexo" && (
        <div style={{ maxWidth: 900 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface, display: "flex", justifyContent: "space-between" }}><p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Detalle por proveedor</p><p style={{ color: C.textDim, fontSize: 12 }}>Hoja 1: Detalle Gastos con Proveedor</p></div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "10px 20px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>{["RUC Proveedor","Comprobantes","Base Imponible","Tipo de Gasto"].map(h=>(<p key={h} style={{color:C.textDim,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:0.5}}>{h}</p>))}</div>
            {facturas.filter(f=>f.sri).map((f,i,arr)=>(<div key={f.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"12px 20px",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none",alignItems:"center"}}><div><p style={{color:C.text,fontSize:13,fontWeight:600}}>{f.emisor}</p><p style={{color:C.textDim,fontSize:11}}>{f.ruc}</p></div><p style={{color:C.textMid,fontSize:13}}>{f.comprobantes}</p><p style={{color:C.text,fontSize:13,fontWeight:700}}>{fmt(f.monto)}</p><Badge color={catColors[f.categoria]||"#ccc"}>{f.categoria.toUpperCase()}</Badge></div>))}
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"13px 20px",background:C.greenMid}}><p style={{color:"rgba(255,255,255,0.7)",fontSize:13,fontWeight:600,gridColumn:"1/3"}}>Total gastos deducibles</p><p style={{color:C.yellow,fontSize:14,fontWeight:800}}>{fmt(facturas.filter(f=>f.sri).reduce((a,b)=>a+b.monto,0))}</p></div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={handleGenerateAnexo} disabled={!perfilValido||generating} style={{padding:"12px 24px",background:perfilValido?C.green:C.border,color:perfilValido?C.white:C.textDim,border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:perfilValido?"pointer":"not-allowed",fontFamily:"DM Sans, sans-serif",display:"flex",alignItems:"center",gap:8}}><Icon name="download" color={perfilValido?C.white:C.textDim} size={18} />{generating?"Generando...":"Generar Anexo GSP (.xlsx)"}</button>
            <button onClick={handleGenerateAmbos} disabled={!perfilValido||generating} style={{padding:"12px 24px",background:"transparent",color:C.green,border:`2px solid ${C.border}`,borderRadius:10,fontSize:14,fontWeight:700,cursor:perfilValido?"pointer":"not-allowed",fontFamily:"DM Sans, sans-serif",display:"flex",alignItems:"center",gap:8}}><Icon name="download" color={C.green} size={18} /> Generar ambos formularios</button>
          </div>
          {!perfilValido && <p style={{ color: C.textDim, fontSize: 12, marginTop: 8 }}>Completa tu perfil primero</p>}
        </div>
      )}

      {tab === "guia" && (
        <div style={{ maxWidth: 820 }}>
          <div style={{ marginBottom: 28 }}><p style={{ color: C.green, fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 800 }}>Tu declaración, facilito.</p><p style={{ color: C.textMid, fontSize: 13, marginTop: 6 }}>Sigue estos pasos para declarar en el portal del SRI. Tienes todo listo — solo necesitas 15 minutos.</p></div>
          <div style={{ background: C.yellowDim, border: `1px solid ${C.yellow}40`, borderRadius: 14, padding: "18px 22px", marginBottom: 28, display: "flex", alignItems: "center", gap: 16 }}>
            <Icon name="inventory_2" color={C.green} size={28} />
            <div style={{ flex: 1 }}><p style={{ color: C.green, fontSize: 14, fontWeight: 700 }}>Descarga tu archivo de referencia</p><p style={{ color: C.textMid, fontSize: 12, marginTop: 2 }}>JSON con los conceptos del SRI (casilleros 773-797) listos para subir al portal</p></div>
            <button onClick={() => generarJSONSRI({ perfil, catTotals })} style={{ padding: "10px 20px", background: C.green, color: C.white, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "DM Sans, sans-serif", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}><Icon name="download" color={C.white} size={16} /> Descargar JSON</button>
          </div>
          {/* Valores tabla */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "14px 20px", background: C.surface, borderBottom: `1px solid ${C.border}` }}><p style={{ color: C.text, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Icon name="bar_chart" color={C.greenAccent} size={18} /> Valores que debes ingresar en el formulario</p><p style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>Gastos proyectados anuales (tu mes × 12)</p></div>
            <div style={{ display: "grid", gridTemplateColumns: "40px 1fr auto auto" }}>
              <div style={{ display: "contents" }}><div style={{ padding: "8px 12px", background: C.surface, borderBottom: `1px solid ${C.border}` }}><p style={{ color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Campo</p></div><div style={{ padding: "8px 12px", background: C.surface, borderBottom: `1px solid ${C.border}` }}><p style={{ color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Categoría</p></div><div style={{ padding: "8px 12px", background: C.surface, borderBottom: `1px solid ${C.border}` }}><p style={{ color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Mensual</p></div><div style={{ padding: "8px 12px", background: C.surface, borderBottom: `1px solid ${C.border}`, paddingRight: 20 }}><p style={{ color: C.textDim, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>Anual (× 12)</p></div></div>
              {Object.entries(CAT_SRI).map(([cat, { field }], i, arr) => (<div key={cat} style={{ display: "contents" }}><div style={{ padding: "11px 12px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center" }}><span style={{ fontSize: 10, background: (catColors[cat] || "#ccc") + "15", color: catColors[cat] || "#ccc", padding: "2px 5px", borderRadius: 4, fontWeight: 700 }}>{field}</span></div><div style={{ padding: "11px 12px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 6 }}><Icon name={catIcons[cat]} color={catColors[cat]} size={16} /><span style={{ color: C.text, fontSize: 13 }}>{cat}</span></div><div style={{ padding: "11px 12px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center" }}><span style={{ color: C.textMid, fontSize: 13 }}>{fmt(catTotals[cat] || 0)}</span></div><div style={{ padding: "11px 20px 11px 12px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center" }}><span style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{fmt((catTotals[cat] || 0) * 12)}</span></div></div>))}
              <div style={{ display: "contents" }}><div style={{ gridColumn: "1 / 3", padding: "12px 20px", background: C.greenMid }}><span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>Campo 112 · Total gastos proyectados</span></div><div style={{ padding: "12px 12px", background: C.greenMid }}><span style={{ color: C.yellow, fontSize: 14, fontWeight: 800 }}>{fmt(totalDeducible)}</span></div><div style={{ padding: "12px 20px 12px 12px", background: C.greenMid }}><span style={{ color: C.yellow, fontSize: 14, fontWeight: 800 }}>{fmt(totalDeducible * 12)}</span></div></div>
            </div>
          </div>
          {/* Pasos */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              { num: 1, icon: "key", titulo: "Ingresa al portal SRI", desc: "Ve a sri.gob.ec y haz clic en 'SRI en línea'. Ingresa con tu cédula y contraseña.", accion: <button onClick={() => window.open("https://srienlinea.sri.gob.ec", "_blank")} style={{ padding: "9px 18px", background: C.green, color: C.white, border: "none", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>Abrir portal SRI →</button> },
              { num: 2, icon: "receipt_long", titulo: "Navega a Declaraciones → Formulario 102A", desc: 'Selecciona "Mis Declaraciones" → "Impuesto a la Renta" → "Formulario 102A". Selecciona el período fiscal.' },
              { num: 3, icon: "edit", titulo: "Ingresa los gastos personales", desc: 'Busca la sección "Gastos Personales Proyectados". Ingresa los valores anuales de la tabla de arriba en los campos 106 al 112.' },
              { num: 4, icon: "rocket_launch", titulo: "Revisa, firma y envía", desc: 'Verifica que los valores sean correctos. Haz clic en "Firmar y Enviar". Descarga el comprobante.' },
            ].map((paso, idx, arr) => (
              <div key={paso.num} style={{ display: "flex" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 48, flexShrink: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: C.green, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: C.white, fontFamily: "Syne, sans-serif", flexShrink: 0, zIndex: 1 }}>{paso.num}</div>
                  {idx < arr.length - 1 && <div style={{ width: 2, flex: 1, background: C.border, margin: "4px 0", minHeight: 24 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: idx < arr.length - 1 ? 24 : 0, paddingLeft: 16 }}>
                  <p style={{ color: C.text, fontSize: 15, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}><Icon name={paso.icon} color={C.greenAccent} size={20} /> {paso.titulo}</p>
                  <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: paso.accion ? 12 : 0 }}>{paso.desc}</p>
                  {paso.accion}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 28, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <Icon name="lightbulb" color={C.yellow} size={22} />
            <p style={{ color: C.textMid, fontSize: 12, lineHeight: 1.6 }}><strong style={{ color: C.text }}>Tip:</strong> Si el portal SRI no te permite ingresar valores decimales, redondea al número entero más cercano.</p>
          </div>
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
          setFacturas(facturasData.map(f => ({ id: f.id, emisor: f.emisor, ruc: f.ruc || "", fecha: f.fecha, monto: f.monto, categoria: f.categoria, sri: f.es_deducible_sri, comprobantes: f.comprobantes || 1, fuente: f.fuente || "manual" })));
        }
        if (perfilData) {
          setPerfil({ cedula: perfilData.cedula || "", nombre: perfilData.nombre || "", salario: perfilData.salario_mensual?.toString() || "", otrosIngresos: perfilData.otros_ingresos?.toString() || "", cargas: perfilData.cargas_familiares?.toString() || "0", enfermedadCatastrofica: perfilData.enfermedad_catastrofica || false, _id: perfilData.id });
        }
      } catch (e) { console.error("Error cargando datos:", e); }
      setAppLoading(false);
    }
    loadData();
  }, [user]);

  const updatePerfil = (k, v) => setPerfil(prev => ({ ...prev, [k]: v }));
  const savePerfil = async (p) => {
    if (!navigator.onLine) { setSyncStatus("error"); return; }
    setSyncStatus("saving");
    try {
      const payload = { user_id: user.id, cedula: p.cedula, nombre: p.nombre, salario_mensual: parseFloat(p.salario) || 0, otros_ingresos: parseFloat(p.otrosIngresos) || 0, cargas_familiares: parseInt(p.cargas) || 0, enfermedad_catastrofica: p.enfermedadCatastrofica || false };
      if (p._id) { await supabase.from("perfil").update(payload).eq("id", p._id); }
      else { const { data } = await supabase.from("perfil").insert(payload).select().single(); if (data) setPerfil(prev => ({ ...prev, _id: data.id })); }
      setSyncStatus("saved"); setTimeout(() => setSyncStatus("idle"), 2000);
    } catch { setSyncStatus("error"); }
  };
  const saveFacturas = async (nuevasFacturas) => {
    if (!user || nuevasFacturas.length === 0) return;
    setSyncStatus("saving");
    try {
      const payload = nuevasFacturas.map(f => ({ user_id: user.id, emisor: f.emisor, ruc: f.ruc, fecha: f.fecha, monto: f.monto, categoria: f.categoria, es_deducible_sri: f.sri, comprobantes: f.comprobantes || 1, fuente: f.fuente || "gmail" }));
      await supabase.from("facturas").upsert(payload, { onConflict: "user_id,ruc,fecha,monto" });
      setSyncStatus("saved"); setTimeout(() => setSyncStatus("idle"), 2000);
    } catch (e) { console.error("Error guardando facturas:", e); setSyncStatus("error"); }
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuario";
  const userAvatar = user?.user_metadata?.avatar_url;
  const initiales = userName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  if (appLoading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#FFFFFF", flexDirection: "column", gap: 12 }}>
      <svg width="48" height="48" viewBox="0 0 56 56" fill="none"><rect width="56" height="56" rx="14" fill="#F5E642"/><path d="M14 28.5L23.5 38L42 19" stroke="#1A3A2A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      <p style={{ color: "#1A3A2A", fontSize: 20, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>facilito</p>
      <p style={{ color: "#8FA894", fontSize: 12 }}>Cargando...</p>
    </div>
  );

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
            <svg width="30" height="30" viewBox="0 0 56 56" fill="none" style={{flexShrink:0}}><rect width="56" height="56" rx="14" fill="#F5E642"/><path d="M14 28.5L23.5 38L42 19" stroke="#1A3A2A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div><p style={{ color: C.yellow, fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>facilito</p><p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>tus impuestos, facilito</p></div>
          </div>
        </div>
        <nav style={{ padding: "8px 12px", flex: 1 }}>
          {[{ id: "dashboard", icon: "home", label: "Inicio" }, { id: "facturas", icon: "receipt_long", label: "Facturas" }, { id: "declaracion", icon: "check_circle", label: "Tu declaración" }, { id: "conectar", icon: "sync", label: "Sincronizar" }].map(item => {
            const active = screen === item.id;
            return (
              <button key={item.id} onClick={() => setScreen(item.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: active ? C.greenMid : "transparent", marginBottom: 4, transition: "all 0.15s", textAlign: "left", borderLeft: active ? `3px solid ${C.yellow}` : "3px solid transparent" }}>
                <Icon name={item.icon} color={active ? C.yellow : "rgba(255,255,255,0.4)"} size={18} />
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.white : "rgba(255,255,255,0.5)", fontFamily: "DM Sans, sans-serif" }}>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {userAvatar ? <img src={userAvatar} style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover" }} alt="avatar" /> : <div style={{ width: 34, height: 34, borderRadius: 10, background: C.yellow, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: C.green, fontFamily: "Syne, sans-serif" }}>{initiales}</div>}
            <div style={{ flex: 1, minWidth: 0 }}><p style={{ color: C.white, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</p><p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</p></div>
          </div>
          <button onClick={logout} style={{ width: "100%", padding: "8px", background: "transparent", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>Cerrar sesión</button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 32px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <p style={{ color: C.textDim, fontSize: 12 }}>{new Date().toLocaleDateString("es-EC", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {syncStatus === "saving" && <span style={{ color: C.green, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Icon name="sync" color={C.green} size={14} /> Guardando...</span>}
            {syncStatus === "saved" && <span style={{ color: C.greenAccent, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Icon name="check_circle" color={C.greenAccent} size={14} /> Todo listo</span>}
            {syncStatus === "error" && <span style={{ color: C.red, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Icon name="warning" color={C.red} size={14} /> Sin conexión</span>}
            <div style={{ width: 8, height: 8, borderRadius: 4, background: C.greenAccent }} />
            <span style={{ color: C.textMid, fontSize: 12 }}>Todo bien</span>
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
