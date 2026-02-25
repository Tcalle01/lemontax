import { useState, useEffect } from "react";
import { C, catColors, catIcons } from "../theme";
import Icon from "../components/Icon";
import { useAuth } from "../auth";
import { supabase } from "../supabase";

function fmt(n) { return `$${n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function Badge({ children, color }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: color + "20", color }}>{children}</span>;
}

const CATS = ["Todas", ...Object.keys(catColors)];

export default function FacturasPage() {
  const { user } = useAuth();
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editCat, setEditCat] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("facturas").select("*").eq("user_id", user.id).order("fecha", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setFacturas(data.map(f => ({
            id: f.id, emisor: f.emisor, ruc: f.ruc || "",
            fecha: f.fecha, monto: f.monto, categoria: f.categoria,
            sri: f.es_deducible_sri, comprobantes: f.comprobantes || 1,
          })));
        }
        setLoading(false);
      });
  }, [user]);

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

  if (loading) return (
    <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: C.textDim, fontSize: 13 }}>Cargando facturas...</p>
    </div>
  );

  return (
    <div style={{ padding: 32, overflowY: "auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Mis Facturas</h1>
        <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Gestiona tus comprobantes de gastos personales</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total filtrado", value: fmt(total), color: C.text },
          { label: "Deducible SRI", value: fmt(deducible), color: C.greenAccent },
          { label: "Facturas", value: filtered.length, color: C.green },
        ].map((s, i) => (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 20px", display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</p>
            <p style={{ color: s.color, fontSize: 20, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por emisor o RUC..."
          style={{
            padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
            background: C.surface, color: C.text, fontSize: 13, outline: "none",
            width: 260, fontFamily: "DM Sans, sans-serif",
          }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATS.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} style={{
              padding: "7px 14px", borderRadius: 8,
              border: `1px solid ${filter === cat ? C.green : C.border}`,
              background: filter === cat ? C.green : "transparent",
              color: filter === cat ? C.white : C.textMid,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "DM Sans, sans-serif", transition: "all 0.15s",
            }}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 40, textAlign: "center" }}>
          <Icon name="receipt_long" color={C.textDim} size={40} />
          <p style={{ color: C.textDim, fontSize: 13, marginTop: 16 }}>
            {facturas.length === 0 ? "Sin facturas aún — conecta Gmail en Ajustes para importar" : "Sin resultados para este filtro"}
          </p>
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 120px 80px 90px 80px 100px", padding: "12px 20px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
            {["Emisor / RUC", "Categoría", "Fecha", "Comp.", "Monto", "SRI", "Acción"].map(h => (
              <p key={h} style={{ color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</p>
            ))}
          </div>
          {/* Rows */}
          {filtered.map((f, i) => (
            <div key={f.id} style={{
              display: "grid", gridTemplateColumns: "2fr 1.4fr 120px 80px 90px 80px 100px",
              padding: "13px 20px", borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: (catColors[f.categoria] || "#ccc") + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name={catIcons[f.categoria] || "receipt_long"} color={catColors[f.categoria] || "#ccc"} size={16} />
                </div>
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
              <div>{f.sri ? <Badge color={C.greenAccent}>SRI</Badge> : <Badge color={C.textDim}>No</Badge>}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {editingId === f.id ? (
                  <>
                    <button onClick={() => saveEdit(f.id)} style={{ padding: "4px 8px", background: C.greenAccent + "20", color: C.greenAccent, border: `1px solid ${C.greenAccent}40`, borderRadius: 6, cursor: "pointer" }}>
                      <Icon name="check" color={C.greenAccent} size={14} />
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ padding: "4px 8px", background: "transparent", color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer" }}>
                      <Icon name="close" color={C.textDim} size={14} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setEditingId(f.id); setEditCat(f.categoria); }} style={{ fontSize: 11, padding: "4px 10px", background: "transparent", color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontWeight: 600 }}>
                    Editar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
