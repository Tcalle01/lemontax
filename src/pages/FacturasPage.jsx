import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { C, catColors, catIcons } from "../theme";
import Icon from "../components/Icon";
import { useAuth } from "../auth";
import { usePerfil } from "../hooks/usePerfil";
import { supabase } from "../supabase";
import { parsearXMLVenta } from "../utils/parsearXMLVenta";

const fmt = (n) =>
  `$${(+n || 0).toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const NOW = new Date();

const TIPOS_CON_IVA = [
  "rimpe_emprendedor",
  "dependencia_con_extras",
  "freelancer_general",
  "arrendador_general",
];

const INPUT = {
  padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
  background: C.surface, color: C.text, fontSize: 13, outline: "none",
  fontFamily: "DM Sans, sans-serif", width: "100%", boxSizing: "border-box",
};

const LABEL = {
  display: "block", color: C.textMid, fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 16,
};

function Badge({ children, color, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
        background: color + "22", color,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {children}
    </span>
  );
}

// ── Compras Tab ───────────────────────────────────────────────────────────────

const CATS = ["Todas", ...Object.keys(catColors)];

function ComprasTab({ user }) {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editCat, setEditCat] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("facturas")
      .select("*")
      .eq("user_id", user.id)
      .neq("es_venta", true)
      .order("fecha", { ascending: false })
      .then(({ data }) => {
        if (data) {
          setFacturas(
            data.map((f) => ({
              id: f.id, emisor: f.emisor, ruc: f.ruc || "",
              fecha: f.fecha, monto: f.monto, categoria: f.categoria,
              sri: f.es_deducible_sri, comprobantes: f.comprobantes || 1,
            }))
          );
        }
        setLoading(false);
      });
  }, [user]);

  const filtered = facturas
    .filter((f) => filter === "Todas" || f.categoria === filter)
    .filter(
      (f) =>
        f.emisor?.toLowerCase().includes(search.toLowerCase()) ||
        f.ruc?.includes(search)
    );

  const total = filtered.reduce((a, b) => a + (b.monto || 0), 0);
  const deducible = filtered.filter((f) => f.sri).reduce((a, b) => a + (b.monto || 0), 0);

  const saveEdit = async (id) => {
    setFacturas((prev) => prev.map((f) => (f.id === id ? { ...f, categoria: editCat } : f)));
    setEditingId(null);
    await supabase.from("facturas").update({ categoria: editCat }).eq("id", id);
  };

  if (loading)
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: C.textDim, fontSize: 13 }}>Cargando facturas...</p>
      </div>
    );

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total filtrado", value: fmt(total), color: C.text },
          { label: "Deducible SRI", value: fmt(deducible), color: C.greenAccent },
          { label: "Facturas", value: filtered.length, color: C.green },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: "14px 20px", display: "flex", flexDirection: "column", gap: 4,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <p style={{ color: C.textDim, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</p>
            <p style={{ color: s.color, fontSize: 20, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por emisor o RUC..."
          style={{ ...INPUT, width: 260 }}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATS.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                padding: "7px 14px", borderRadius: 8,
                border: `1px solid ${filter === cat ? C.green : C.border}`,
                background: filter === cat ? C.green : "transparent",
                color: filter === cat ? C.white : C.textMid,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: "DM Sans, sans-serif", transition: "all 0.15s",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 40, textAlign: "center" }}>
          <Icon name="receipt_long" color={C.textDim} size={40} />
          <p style={{ color: C.textDim, fontSize: 13, marginTop: 16 }}>
            {facturas.length === 0
              ? "Sin facturas aún — conecta Gmail en Ajustes para importar"
              : "Sin resultados para este filtro"}
          </p>
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 120px 80px 90px 80px 100px", padding: "12px 20px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
            {["Emisor / RUC", "Categoría", "Fecha", "Comp.", "Monto", "SRI", "Acción"].map((h) => (
              <p key={h} style={{ color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</p>
            ))}
          </div>
          {filtered.map((f, i) => (
            <div
              key={f.id}
              style={{
                display: "grid", gridTemplateColumns: "2fr 1.4fr 120px 80px 90px 80px 100px",
                padding: "13px 20px",
                borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none",
                alignItems: "center",
              }}
            >
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
                  <select
                    value={editCat}
                    onChange={(e) => setEditCat(e.target.value)}
                    style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "DM Sans, sans-serif", outline: "none" }}
                  >
                    {Object.keys(catColors).map((c) => <option key={c} value={c}>{c}</option>)}
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
                  <button
                    onClick={() => { setEditingId(f.id); setEditCat(f.categoria); }}
                    style={{ fontSize: 11, padding: "4px 10px", background: "transparent", color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontWeight: 600 }}
                  >
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

// ── Agregar Ingreso Modal ─────────────────────────────────────────────────────

const METODOS = [
  { id: "xml", icon: "upload_file", title: "Subir XML del SRI", desc: "Descarga el XML de tu factura electrónica desde el portal del SRI y súbelo aquí. Se completa solo." },
  { id: "manual", icon: "edit_note", title: "Ingresar manualmente", desc: "Llena el formulario con los datos de la factura: cliente, monto, IVA, estado de cobro." },
  { id: "rapido", icon: "bolt", title: "Ingreso rápido", desc: "Solo fecha, descripción y monto. Para honorarios en efectivo o ingresos sin comprobante." },
];

function EstadoCobroSelector({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      {[["cobrado", "Cobrado", C.greenAccent], ["pendiente", "Pendiente de cobro", C.orange]].map(([val, label, color]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          style={{
            flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
            background: value === val ? color + "18" : "transparent",
            color: value === val ? color : C.textMid,
            border: `1px solid ${value === val ? color : C.border}`,
            fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600,
            transition: "all 0.15s",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AgregarIngresoModal({ user, perfil, onClose, onSaved }) {
  const [metodo, setMetodo] = useState(null);

  // XML
  const fileRef = useRef();
  const [xmlParsed, setXmlParsed] = useState(null);
  const [xmlError, setXmlError] = useState("");
  const [xmlEstado, setXmlEstado] = useState("cobrado");

  // Manual
  const [manFecha, setManFecha] = useState(NOW.toISOString().split("T")[0]);
  const [manNumero, setManNumero] = useState("");
  const [manCliente, setManCliente] = useState("");
  const [manClienteRuc, setManClienteRuc] = useState("");
  const [manDesc, setManDesc] = useState("");
  const [manSubtotal, setManSubtotal] = useState("");
  const [manIva, setManIva] = useState("15");
  const [manEstado, setManEstado] = useState("cobrado");

  // Rápido
  const [rapFecha, setRapFecha] = useState(NOW.toISOString().split("T")[0]);
  const [rapDesc, setRapDesc] = useState("");
  const [rapMonto, setRapMonto] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const manTotal = manSubtotal
    ? ((parseFloat(manSubtotal) || 0) * (1 + parseInt(manIva) / 100)).toFixed(2)
    : "";

  const handleXmlFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setXmlError("");
    setXmlParsed(null);
    const text = await file.text();
    const parsed = parsearXMLVenta(text);
    if (parsed) {
      setXmlParsed(parsed);
    } else {
      setXmlError("No se pudo leer el XML. Asegúrate de que es una factura electrónica válida del SRI (Formulario 01).");
    }
  };

  const guardarXml = async () => {
    if (!xmlParsed) return;
    setGuardando(true);
    setError("");
    const { error: err } = await supabase.from("facturas").upsert(
      {
        user_id: user.id,
        emisor: perfil?.nombre || xmlParsed.emisor || "Mi empresa",
        ruc: perfil?.cedula || xmlParsed.ruc || "",
        fecha: xmlParsed.fecha,
        monto: xmlParsed.subtotal,
        tarifa_iva: xmlParsed.tarifaIva,
        categoria: "Ventas",
        es_deducible_sri: false,
        clave_acceso: xmlParsed.claveAcceso || crypto.randomUUID(),
        fuente: "xml",
        es_venta: true,
        cliente_nombre: xmlParsed.clienteNombre || null,
        cliente_ruc: xmlParsed.clienteRuc || null,
        numero_factura: xmlParsed.numeroFactura || null,
        descripcion: xmlParsed.descripcion || null,
        estado_cobro: xmlEstado,
      },
      { onConflict: "user_id,clave_acceso" }
    );
    setGuardando(false);
    if (err) { setError("Error al guardar. Verifica que la migración SQL esté aplicada."); return; }
    onSaved();
  };

  const guardarManual = async () => {
    if (!manFecha || !manSubtotal || parseFloat(manSubtotal) <= 0) {
      setError("Fecha y subtotal son obligatorios.");
      return;
    }
    setGuardando(true);
    setError("");
    const { error: err } = await supabase.from("facturas").insert({
      user_id: user.id,
      emisor: perfil?.nombre || user.email || "Mi empresa",
      ruc: perfil?.cedula || "",
      fecha: manFecha,
      monto: parseFloat(manSubtotal) || 0,
      tarifa_iva: parseInt(manIva) || 0,
      categoria: "Ventas",
      es_deducible_sri: false,
      clave_acceso: crypto.randomUUID(),
      fuente: "manual",
      es_venta: true,
      cliente_nombre: manCliente || null,
      cliente_ruc: manClienteRuc || null,
      numero_factura: manNumero || null,
      descripcion: manDesc || null,
      estado_cobro: manEstado,
    });
    setGuardando(false);
    if (err) { setError("Error al guardar. Verifica que la migración SQL esté aplicada."); return; }
    onSaved();
  };

  const guardarRapido = async () => {
    if (!rapFecha || !rapMonto || parseFloat(rapMonto) <= 0) {
      setError("Fecha y monto son obligatorios.");
      return;
    }
    setGuardando(true);
    setError("");
    const { error: err } = await supabase.from("facturas").insert({
      user_id: user.id,
      emisor: perfil?.nombre || user.email || "Mi empresa",
      ruc: perfil?.cedula || "",
      fecha: rapFecha,
      monto: parseFloat(rapMonto) || 0,
      tarifa_iva: null,
      categoria: "Ventas",
      es_deducible_sri: false,
      clave_acceso: crypto.randomUUID(),
      fuente: "rapido",
      es_venta: true,
      cliente_nombre: null,
      cliente_ruc: null,
      numero_factura: null,
      descripcion: rapDesc || null,
      estado_cobro: "cobrado",
    });
    setGuardando(false);
    if (err) { setError("Error al guardar. Verifica que la migración SQL esté aplicada."); return; }
    onSaved();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: C.card, borderRadius: 20, padding: 28, width: 520, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {metodo && (
              <button onClick={() => { setMetodo(null); setXmlParsed(null); setXmlError(""); setError(""); }} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
                <Icon name="arrow_back" color={C.textMid} size={20} />
              </button>
            )}
            <h2 style={{ color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
              {metodo === "xml" ? "Subir XML del SRI" : metodo === "manual" ? "Ingresar manualmente" : metodo === "rapido" ? "Ingreso rápido" : "Agregar ingreso"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
            <Icon name="close" color={C.textMid} size={22} />
          </button>
        </div>

        {/* Step 0: choose method */}
        {!metodo && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {METODOS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetodo(m.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
                  cursor: "pointer", textAlign: "left", transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.greenAccent)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: C.greenAccent + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name={m.icon} color={C.greenAccent} size={22} />
                </div>
                <div>
                  <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 3, fontFamily: "DM Sans, sans-serif" }}>{m.title}</p>
                  <p style={{ color: C.textDim, fontSize: 12, lineHeight: 1.5 }}>{m.desc}</p>
                </div>
                <Icon name="chevron_right" color={C.textDim} size={18} style={{ marginLeft: "auto", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {/* Step: XML */}
        {metodo === "xml" && (
          <div>
            <input type="file" accept=".xml,.zip" ref={fileRef} onChange={handleXmlFile} style={{ display: "none" }} />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: "100%", padding: "28px 20px", border: `2px dashed ${xmlParsed ? C.greenAccent : C.border}`,
                borderRadius: 14, background: xmlParsed ? C.greenAccent + "08" : C.surface,
                cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              }}
            >
              <Icon name={xmlParsed ? "check_circle" : "upload_file"} color={xmlParsed ? C.greenAccent : C.textDim} size={36} />
              <p style={{ color: xmlParsed ? C.greenAccent : C.textMid, fontSize: 13, fontWeight: 600, fontFamily: "DM Sans, sans-serif" }}>
                {xmlParsed ? "XML cargado correctamente" : "Haz clic para seleccionar el archivo XML"}
              </p>
              {!xmlParsed && <p style={{ color: C.textDim, fontSize: 11 }}>Formato: .xml o .zip del portal SRI</p>}
            </button>

            {xmlError && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: C.red + "12", border: `1px solid ${C.red}30`, borderRadius: 10 }}>
                <p style={{ color: C.red, fontSize: 12 }}>{xmlError}</p>
              </div>
            )}

            {xmlParsed && (
              <div style={{ marginTop: 16, padding: "16px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                <p style={{ color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Datos extraídos del XML</p>
                {[
                  ["Fecha", xmlParsed.fecha],
                  ["N° Factura", xmlParsed.numeroFactura || "—"],
                  ["Cliente", xmlParsed.clienteNombre || "—"],
                  ["RUC/Cédula cliente", xmlParsed.clienteRuc || "—"],
                  ["Descripción", xmlParsed.descripcion || "—"],
                  ["Subtotal (base)", fmt(xmlParsed.subtotal)],
                  ["IVA", xmlParsed.tarifaIva + "%"],
                  ["Total", fmt(xmlParsed.total)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 6, marginBottom: 6, borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.textDim, fontSize: 12 }}>{k}</span>
                    <span style={{ color: C.text, fontSize: 12, fontWeight: 600, maxWidth: 260, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
                <p style={LABEL}>Estado de cobro</p>
                <EstadoCobroSelector value={xmlEstado} onChange={setXmlEstado} />
              </div>
            )}

            {error && <p style={{ color: C.red, fontSize: 12, marginTop: 12 }}>{error}</p>}

            <button
              onClick={guardarXml}
              disabled={!xmlParsed || guardando}
              style={{
                marginTop: 20, width: "100%", padding: "13px", borderRadius: 12,
                background: xmlParsed ? C.green : C.border,
                color: xmlParsed ? C.white : C.textDim,
                border: "none", cursor: xmlParsed ? "pointer" : "not-allowed",
                fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 700,
              }}
            >
              {guardando ? "Guardando..." : "Guardar factura"}
            </button>
          </div>
        )}

        {/* Step: Manual */}
        {metodo === "manual" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={LABEL}>Fecha *</label>
                <input type="date" value={manFecha} onChange={(e) => setManFecha(e.target.value)} style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>N° Factura</label>
                <input value={manNumero} onChange={(e) => setManNumero(e.target.value)} placeholder="001-001-000000001" style={INPUT} />
              </div>
            </div>

            <label style={LABEL}>Nombre del cliente</label>
            <input value={manCliente} onChange={(e) => setManCliente(e.target.value)} placeholder="Nombre o razón social" style={INPUT} />

            <label style={LABEL}>RUC / Cédula del cliente</label>
            <input value={manClienteRuc} onChange={(e) => setManClienteRuc(e.target.value)} placeholder="0987654321001" style={INPUT} />

            <label style={LABEL}>Descripción del servicio o producto</label>
            <input value={manDesc} onChange={(e) => setManDesc(e.target.value)} placeholder="Consultoría, diseño web, arriendo local..." style={INPUT} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
              <div>
                <label style={{ ...LABEL, marginTop: 0 }}>Subtotal (sin IVA) *</label>
                <input
                  type="number" min="0" step="0.01"
                  value={manSubtotal} onChange={(e) => setManSubtotal(e.target.value)}
                  placeholder="0.00" style={INPUT}
                />
              </div>
              <div>
                <label style={{ ...LABEL, marginTop: 0 }}>IVA</label>
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  {["0", "15"].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => setManIva(rate)}
                      style={{
                        flex: 1, padding: "10px", borderRadius: 8, cursor: "pointer",
                        background: manIva === rate ? C.green : "transparent",
                        color: manIva === rate ? C.white : C.textMid,
                        border: `1px solid ${manIva === rate ? C.green : C.border}`,
                        fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600,
                      }}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {manSubtotal && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: C.surface, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: C.textMid, fontSize: 13 }}>Total a cobrar</span>
                <span style={{ color: C.text, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>{fmt(manTotal)}</span>
              </div>
            )}

            <label style={LABEL}>Estado de cobro</label>
            <EstadoCobroSelector value={manEstado} onChange={setManEstado} />

            {error && <p style={{ color: C.red, fontSize: 12, marginTop: 12 }}>{error}</p>}

            <button
              onClick={guardarManual}
              disabled={guardando}
              style={{
                marginTop: 20, width: "100%", padding: "13px", borderRadius: 12,
                background: C.green, color: C.white, border: "none", cursor: "pointer",
                fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 700,
              }}
            >
              {guardando ? "Guardando..." : "Guardar ingreso"}
            </button>
          </div>
        )}

        {/* Step: Rápido */}
        {metodo === "rapido" && (
          <div>
            <p style={{ color: C.textDim, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              Para honorarios en efectivo, pagos pequeños o ingresos sin comprobante formal.
            </p>

            <label style={LABEL}>Fecha *</label>
            <input type="date" value={rapFecha} onChange={(e) => setRapFecha(e.target.value)} style={INPUT} />

            <label style={LABEL}>Descripción</label>
            <input value={rapDesc} onChange={(e) => setRapDesc(e.target.value)} placeholder="Clase particular, honorario, comisión..." style={INPUT} />

            <label style={LABEL}>Monto recibido *</label>
            <input
              type="number" min="0" step="0.01"
              value={rapMonto} onChange={(e) => setRapMonto(e.target.value)}
              placeholder="0.00" style={INPUT}
            />
            <p style={{ color: C.textDim, fontSize: 11, marginTop: 6 }}>El monto se registra como ingreso sin IVA.</p>

            {error && <p style={{ color: C.red, fontSize: 12, marginTop: 12 }}>{error}</p>}

            <button
              onClick={guardarRapido}
              disabled={guardando}
              style={{
                marginTop: 20, width: "100%", padding: "13px", borderRadius: 12,
                background: C.green, color: C.white, border: "none", cursor: "pointer",
                fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 700,
              }}
            >
              {guardando ? "Guardando..." : "Registrar ingreso"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ventas Tab ────────────────────────────────────────────────────────────────

function VentasTab({ user, perfil, tipoContribuyente }) {
  const navigate = useNavigate();
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(NOW.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(NOW.getFullYear());
  const [showModal, setShowModal] = useState(false);

  const hasIVA = TIPOS_CON_IVA.includes(tipoContribuyente);

  const cargarVentas = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("facturas")
      .select("*")
      .eq("user_id", user.id)
      .eq("es_venta", true)
      .order("fecha", { ascending: false });
    setVentas(data || []);
    setLoading(false);
  };

  useEffect(() => { cargarVentas(); }, [user]); // eslint-disable-line

  const ventasMes = ventas.filter((v) => {
    if (!v.fecha) return false;
    const d = new Date(v.fecha + "T00:00:00");
    return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
  });

  const totalMes = ventasMes.reduce((a, v) => a + (v.monto || 0), 0);

  const navegarAIVA = () => {
    if (tipoContribuyente === "rimpe_emprendedor") {
      const semestre = selectedMonth <= 6 ? "S1" : "S2";
      navigate(`/obligaciones/iva-semestral/${selectedYear}/${semestre}`);
    } else if (hasIVA) {
      const mes = String(selectedMonth).padStart(2, "0");
      navigate(`/obligaciones/iva/${selectedYear}/${mes}`);
    }
  };

  const toggleEstado = async (id, current) => {
    const nuevo = current === "cobrado" ? "pendiente" : "cobrado";
    setVentas((prev) => prev.map((v) => (v.id === id ? { ...v, estado_cobro: nuevo } : v)));
    await supabase.from("facturas").update({ estado_cobro: nuevo }).eq("id", id);
  };

  const YEARS = [NOW.getFullYear(), NOW.getFullYear() - 1, NOW.getFullYear() - 2];

  const SELECT_STYLE = {
    padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
    background: C.surface, color: C.text, fontSize: 13,
    fontFamily: "DM Sans, sans-serif", outline: "none", cursor: "pointer",
  };

  if (loading)
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: C.textDim, fontSize: 13 }}>Cargando ventas...</p>
      </div>
    );

  return (
    <div>
      {/* Monthly summary banner */}
      <div
        onClick={hasIVA ? navegarAIVA : undefined}
        style={{
          background: C.cardDark, borderRadius: 14, padding: "20px 24px",
          marginBottom: 20, cursor: hasIVA ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => hasIVA && (e.currentTarget.style.opacity = "0.88")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        <div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            {MESES[selectedMonth - 1]} {selectedYear}
          </p>
          <p style={{ color: C.white, fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 800 }}>
            {fmt(totalMes)}
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 3 }}>
            {ventasMes.length === 0
              ? "Sin facturas este mes"
              : `${ventasMes.length} factura${ventasMes.length !== 1 ? "s" : ""} emitida${ventasMes.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {hasIVA && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.yellow, fontSize: 12, fontWeight: 600 }}>
            Ver módulo IVA
            <Icon name="chevron_right" color={C.yellow} size={16} />
          </div>
        )}
      </div>

      {/* Filter row + add button */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(+e.target.value)} style={SELECT_STYLE}>
          {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select value={selectedYear} onChange={(e) => setSelectedYear(+e.target.value)} style={SELECT_STYLE}>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: C.green, color: C.white, cursor: "pointer",
            fontFamily: "Syne, sans-serif", fontSize: 13, fontWeight: 700,
          }}
        >
          <Icon name="add" color={C.white} size={18} />
          Agregar ingreso
        </button>
      </div>

      {/* Ventas list */}
      {ventasMes.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 48, textAlign: "center" }}>
          <Icon name="receipt" color={C.textDim} size={40} />
          <p style={{ color: C.textDim, fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 6 }}>
            Sin ingresos en {MESES[selectedMonth - 1]} {selectedYear}
          </p>
          <p style={{ color: C.textDim, fontSize: 12 }}>
            Usa el botón "Agregar ingreso" para registrar tus facturas emitidas.
          </p>
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 90px 100px 60px 100px 120px", padding: "12px 20px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
            {["Cliente", "Descripción", "Fecha", "Base", "IVA", "Total", "Estado"].map((h) => (
              <p key={h} style={{ color: C.textDim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</p>
            ))}
          </div>
          {/* Rows */}
          {ventasMes.map((v, i) => {
            const iva = v.tarifa_iva;
            const total = iva != null ? (v.monto || 0) * (1 + iva / 100) : v.monto || 0;
            const estadoColor = v.estado_cobro === "cobrado" ? C.greenAccent : C.orange;
            return (
              <div
                key={v.id}
                style={{
                  display: "grid", gridTemplateColumns: "1.6fr 1.4fr 90px 100px 60px 100px 120px",
                  padding: "14px 20px",
                  borderBottom: i < ventasMes.length - 1 ? `1px solid ${C.border}` : "none",
                  alignItems: "center",
                }}
              >
                {/* Cliente */}
                <div>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>
                    {v.cliente_nombre || "—"}
                  </p>
                  <p style={{ color: C.textDim, fontSize: 11 }}>
                    {v.cliente_ruc ? v.cliente_ruc : v.numero_factura ? `N° ${v.numero_factura}` : v.fuente === "rapido" ? "Sin comprobante" : "—"}
                  </p>
                </div>
                {/* Descripción */}
                <p style={{ color: C.textMid, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                  {v.descripcion || v.categoria || "—"}
                </p>
                {/* Fecha */}
                <p style={{ color: C.textMid, fontSize: 12 }}>{v.fecha || "—"}</p>
                {/* Base */}
                <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{fmt(v.monto)}</p>
                {/* IVA */}
                <p style={{ color: C.textMid, fontSize: 12 }}>
                  {iva != null ? `${iva}%` : "—"}
                </p>
                {/* Total */}
                <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{fmt(total)}</p>
                {/* Estado */}
                <Badge
                  color={estadoColor}
                  onClick={() => toggleEstado(v.id, v.estado_cobro || "cobrado")}
                >
                  {v.estado_cobro === "pendiente" ? "Pendiente" : "Cobrado"}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <AgregarIngresoModal
          user={user}
          perfil={perfil}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); cargarVentas(); }}
        />
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FacturasPage() {
  const { user } = useAuth();
  const { perfil, tipoContribuyente } = usePerfil();
  const isDependenciaPura = tipoContribuyente === "dependencia_pura";
  const [activeTab, setActiveTab] = useState("compras");

  return (
    <div style={{ padding: 32, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Mis Facturas</h1>
        <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>
          {isDependenciaPura
            ? "Gestiona tus comprobantes de gastos personales"
            : "Gestiona tus comprobantes de compras e ingresos facturados"}
        </p>
      </div>

      {/* Tabs — solo si no es dependencia_pura */}
      {!isDependenciaPura && (
        <div style={{ display: "flex", gap: 0, marginBottom: 28, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", width: "fit-content" }}>
          {[
            { id: "compras", icon: "shopping_cart", label: "Compras" },
            { id: "ventas", icon: "receipt", label: "Ventas" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 24px", border: "none", cursor: "pointer",
                background: activeTab === tab.id ? C.green : "transparent",
                color: activeTab === tab.id ? C.white : C.textMid,
                fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 13,
                transition: "all 0.15s",
              }}
            >
              <Icon name={tab.icon} color={activeTab === tab.id ? C.white : C.textMid} size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab content */}
      {activeTab === "compras" || isDependenciaPura ? (
        <ComprasTab user={user} />
      ) : (
        <VentasTab user={user} perfil={perfil} tipoContribuyente={tipoContribuyente} />
      )}
    </div>
  );
}
