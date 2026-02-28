import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C, catColors, catIcons } from "../theme";
import Icon from "../components/Icon";
import { useAuth } from "../auth";
import { usePerfil } from "../hooks/usePerfil";
import { supabase } from "../supabase";
import { generarFormularioGP, generarAnexoGSP } from "../sriExport";

const CATS_DEDUCIBLES = ["Salud", "Educación", "Alimentación", "Vivienda", "Vestimenta"];
const LIMITE_MAX = 15817;

const OPCIONES_CLASIFICACION = [
  { cat: "Salud", icon: "medication" },
  { cat: "Educación", icon: "school" },
  { cat: "Alimentación", icon: "shopping_cart" },
  { cat: "Vivienda", icon: "home" },
  { cat: "Vestimenta", icon: "checkroom" },
];

function fmt(n) {
  return `$${(n || 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function FacturaSinClasificar({ factura, clasificando, onClasificar, onNoDeducible }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 16,
      opacity: clasificando ? 0 : 1,
      transform: clasificando ? "translateX(16px)" : "none",
      transition: "opacity 0.3s ease, transform 0.3s ease",
      pointerEvents: clasificando ? "none" : "auto",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: C.text, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {factura.emisor || "Sin nombre"}
          </p>
          <p style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{factura.fecha}</p>
        </div>
        <p style={{ color: C.text, fontSize: 14, fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>
          {fmt(factura.monto)}
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {OPCIONES_CLASIFICACION.map(({ cat, icon }) => (
          <button
            key={cat}
            onClick={() => onClasificar(cat)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${(catColors[cat] || C.greenAccent)}40`,
              background: (catColors[cat] || C.greenAccent) + "15",
              color: catColors[cat] || C.greenAccent,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "DM Sans, sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Icon name={icon} color={catColors[cat] || C.greenAccent} size={13} />
            {cat}
          </button>
        ))}
        <button
          onClick={onNoDeducible}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.textMid,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Icon name="close" color={C.textMid} size={13} />
          No es gasto personal
        </button>
      </div>
    </div>
  );
}

export default function GastosPersonalesPage() {
  const { anio } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { perfil } = usePerfil();

  const [facturas, setFacturas] = useState([]);
  const [totalVentas, setTotalVentas] = useState(0);
  const [declaracion, setDeclaracion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clasificandoId, setClasificandoId] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [fechaPresentacion, setFechaPresentacion] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);

  const anioNum = parseInt(anio);

  useEffect(() => {
    if (!user) return;
    Promise.allSettled([
      supabase.from("facturas")
        .select("*")
        .eq("user_id", user.id)
        .gte("fecha", `${anio}-01-01`)
        .lte("fecha", `${anio}-12-31`),
      supabase.from("declaraciones_agp")
        .select("*")
        .eq("user_id", user.id)
        .eq("anio_fiscal", anioNum)
        .maybeSingle(),
    ]).then(([facRes, decRes]) => {
      if (facRes.status === "fulfilled" && facRes.value.data) {
        const all = facRes.value.data;
        setFacturas(all.filter(f => !f.es_venta));
        setTotalVentas(
          all.filter(f => f.es_venta).reduce((sum, v) => sum + (v.monto || 0), 0)
        );
      }
      if (decRes.status === "fulfilled" && decRes.value.data) {
        setDeclaracion(decRes.value.data);
      }
      setLoading(false);
    });
  }, [user, anio, anioNum]);

  // Derived
  const sinClasificar = facturas.filter(
    f => !f.categoria || f.categoria.trim() === ""
  );

  const totalesCat = {};
  CATS_DEDUCIBLES.forEach(cat => {
    totalesCat[cat] = facturas
      .filter(f => f.categoria === cat)
      .reduce((sum, f) => sum + (f.monto || 0), 0);
  });

  const totalDeducible = Object.values(totalesCat).reduce((sum, v) => sum + v, 0);
  const ingresosAnuales = parseFloat(perfil.salario || 0) * 12 + totalVentas;
  const limite = ingresosAnuales > 0 ? Math.min(ingresosAnuales * 0.5, LIMITE_MAX) : LIMITE_MAX;
  const efectivo = Math.min(totalDeducible, limite);
  const ahorroEstimado = efectivo * 0.15;

  const potencialSinClasificar = sinClasificar.reduce((sum, f) => sum + (f.monto || 0), 0);
  const ahorroAdicional = Math.min(potencialSinClasificar, Math.max(0, limite - efectivo)) * 0.15;

  const perfilValido = !!(perfil.cedula && perfil.nombre);
  const estadoAgp = declaracion?.estado === "presentada"
    ? "presentada"
    : sinClasificar.length === 0 ? "lista" : "pendiente";

  const clasificar = async (facturaId, categoria) => {
    if (clasificandoId) return;
    setClasificandoId(facturaId);
    const esDeducible = CATS_DEDUCIBLES.includes(categoria);
    const { error } = await supabase.from("facturas")
      .update({ categoria, es_deducible_sri: esDeducible })
      .eq("id", facturaId)
      .eq("user_id", user.id);
    if (!error) {
      setTimeout(() => {
        setFacturas(prev =>
          prev.map(f => f.id === facturaId ? { ...f, categoria, es_deducible_sri: esDeducible } : f)
        );
        setClasificandoId(null);
      }, 320);
    } else {
      setClasificandoId(null);
    }
  };

  const marcarPresentada = async () => {
    setGuardando(true);
    const payload = {
      user_id: user.id,
      anio_fiscal: anioNum,
      total_salud: totalesCat["Salud"] || 0,
      total_educacion: totalesCat["Educación"] || 0,
      total_alimentacion: totalesCat["Alimentación"] || 0,
      total_vivienda: totalesCat["Vivienda"] || 0,
      total_vestimenta: totalesCat["Vestimenta"] || 0,
      total_deducible: totalDeducible,
      ahorro_estimado: ahorroEstimado,
      estado: "presentada",
      fecha_presentacion: fechaPresentacion || null,
    };
    const { data, error } = await supabase.from("declaraciones_agp")
      .upsert(payload, { onConflict: "user_id,anio_fiscal" })
      .select()
      .single();
    if (!error && data) setDeclaracion(data);
    setGuardando(false);
    setMostrarModal(false);
  };

  const facturasFormato = () => facturas.map(f => ({
    id: f.id, emisor: f.emisor, ruc: f.ruc || "", fecha: f.fecha,
    monto: f.monto, categoria: f.categoria, sri: f.es_deducible_sri, comprobantes: 1,
  }));

  const handleGenerarGP = () => {
    if (!perfilValido || generando) return;
    setGenerando(true);
    setTimeout(() => {
      generarFormularioGP({
        perfil,
        facturas: facturasFormato(),
        rebaja: ahorroEstimado,
        salarioAnual: parseFloat(perfil.salario || 0) * 12,
        cargas: parseInt(perfil.cargas || 0),
      });
      setGenerando(false);
    }, 500);
  };

  const handleGenerarGSP = () => {
    if (!perfilValido || generando) return;
    setGenerando(true);
    setTimeout(() => {
      generarAnexoGSP({ perfil, facturas: facturasFormato() });
      setGenerando(false);
    }, 500);
  };

  const handleGenerarAmbos = () => {
    if (!perfilValido || generando) return;
    setGenerando(true);
    const fmts = facturasFormato();
    setTimeout(() => {
      generarFormularioGP({
        perfil,
        facturas: fmts,
        rebaja: ahorroEstimado,
        salarioAnual: parseFloat(perfil.salario || 0) * 12,
        cargas: parseInt(perfil.cargas || 0),
      });
      generarAnexoGSP({ perfil, facturas: fmts });
      setGenerando(false);
    }, 500);
  };

  if (loading) return (
    <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: C.textDim, fontSize: 13 }}>Cargando...</p>
    </div>
  );

  return (
    <div style={{ padding: 32, overflowY: "auto", maxWidth: 880 }}>
      {/* Back */}
      <button
        onClick={() => navigate("/obligaciones")}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: C.textMid, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 6,
          marginBottom: 20, fontFamily: "DM Sans, sans-serif", padding: 0,
        }}
      >
        <Icon name="arrow_back" color={C.textMid} size={16} /> Mis obligaciones
      </button>

      {/* ─── Header ─── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
              Gastos personales deducibles {anio}
            </h1>
            <p style={{ color: C.textMid, fontSize: 13, marginTop: 6, maxWidth: 520, lineHeight: 1.6 }}>
              Clasifica tus facturas de compras para pagar menos impuesto en tu declaración de renta anual
            </p>
          </div>
          {estadoAgp === "presentada" ? (
            <span style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, background: C.greenAccent + "20", color: C.greenAccent, display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
              <Icon name="check_circle" color={C.greenAccent} size={14} /> Presentada
            </span>
          ) : estadoAgp === "lista" ? (
            <span style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, background: C.blue + "20", color: C.blue, display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
              <Icon name="task_alt" color={C.blue} size={14} /> Lista para presentar
            </span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, background: C.yellow + "30", color: "#D4A017", display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
              <Icon name="pending" color="#D4A017" size={14} /> Pendiente
            </span>
          )}
        </div>
        <p style={{ color: C.textDim, fontSize: 12, marginTop: 10, display: "flex", alignItems: "center", gap: 5 }}>
          <Icon name="schedule" color={C.textDim} size={13} />
          Debes presentar esto en febrero {anioNum + 1}
        </p>
      </div>

      {/* ─── Sección 1: Sin clasificar ─── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Icon name="help_outline" color={sinClasificar.length > 0 ? "#D4A017" : C.greenAccent} size={20} />
          <p style={{ color: C.text, fontSize: 15, fontWeight: 700 }}>Facturas sin clasificar</p>
        </div>
        {sinClasificar.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.greenAccent + "12", borderRadius: 10, padding: "14px 18px" }}>
            <Icon name="check_circle" color={C.greenAccent} size={20} />
            <p style={{ color: C.greenAccent, fontSize: 13, fontWeight: 600 }}>Todas tus facturas están clasificadas</p>
          </div>
        ) : (
          <>
            <div style={{ background: C.yellow + "25", border: `1px solid ${C.yellow}50`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
              <p style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>
                Tienes {sinClasificar.length} factura{sinClasificar.length !== 1 ? "s" : ""} sin clasificar
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sinClasificar.map(f => (
                <FacturaSinClasificar
                  key={f.id}
                  factura={f}
                  clasificando={clasificandoId === f.id}
                  onClasificar={cat => clasificar(f.id, cat)}
                  onNoDeducible={() => clasificar(f.id, "Otros")}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ─── Sección 2: Resumen por categoría ─── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <p style={{ color: C.text, fontSize: 15, fontWeight: 700 }}>Tu resumen de gastos deducibles</p>
          <span style={{ color: C.greenAccent, fontSize: 13, fontWeight: 700 }}>Límite: {fmt(limite)}</span>
        </div>
        <p style={{ color: C.textDim, fontSize: 12, marginBottom: 20 }}>
          El menor entre 50% de tus ingresos brutos ({fmt(ingresosAnuales)}) y $15,817 — regla SRI {anio}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {CATS_DEDUCIBLES.map(cat => {
            const monto = totalesCat[cat] || 0;
            const pct = limite > 0 ? Math.min((monto / limite) * 100, 100) : 0;
            const color = catColors[cat] || C.greenAccent;
            return (
              <div key={cat}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name={catIcons[cat] || "receipt_long"} color={color} size={17} />
                    </div>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{cat}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{fmt(monto)}</p>
                    <p style={{ color: C.textDim, fontSize: 11 }}>Puedes deducir hasta {fmt(limite)}</p>
                  </div>
                </div>
                <div style={{ height: 6, background: C.border, borderRadius: 3 }}>
                  <div style={{ height: "100%", borderRadius: 3, background: color, width: `${pct}%`, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Total deducible efectivo</span>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: C.greenAccent, fontSize: 18, fontWeight: 800 }}>{fmt(efectivo)}</p>
            {totalDeducible > limite && (
              <p style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>
                {fmt(totalDeducible)} acumulado — límite aplicado
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Sección 3: Ahorro estimado ─── */}
      <div style={{ background: C.cardDark, borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: "0 2px 12px rgba(26,58,42,0.12)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Icon name="savings" color={C.yellow} size={24} />
          <p style={{ color: C.white, fontSize: 15, fontWeight: 700 }}>Tu ahorro estimado en renta</p>
        </div>
        <p style={{ color: C.yellow, fontSize: 36, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 8 }}>
          {fmt(ahorroEstimado)}
        </p>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: sinClasificar.length > 0 && ahorroAdicional > 0 ? 16 : 0, lineHeight: 1.6 }}>
          Gracias a tus gastos deducibles, podrías pagar {fmt(ahorroEstimado)} menos en tu declaración de renta
          (tasa marginal estimada del 15%)
        </p>
        {sinClasificar.length > 0 && ahorroAdicional > 0 && (
          <div style={{ background: C.yellow + "18", border: `1px solid ${C.yellow}35`, borderRadius: 10, padding: "12px 16px" }}>
            <p style={{ color: C.yellow, fontSize: 13, fontWeight: 600 }}>
              Si clasificas todas tus facturas pendientes podrías ahorrar hasta {fmt(ahorroAdicional)} adicionales
            </p>
          </div>
        )}
      </div>

      {/* ─── Sección 4: Listo para presentar ─── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <p style={{ color: C.text, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Listo para presentar</p>
        <p style={{ color: C.textMid, fontSize: 13, marginBottom: !perfilValido ? 16 : 20, lineHeight: 1.6 }}>
          Genera tus formularios listos para ingresar en el portal del SRI.
        </p>
        {!perfilValido && (
          <div style={{ background: C.yellow + "22", border: `1px solid ${C.yellow}50`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="warning" color={C.green} size={16} />
            <p style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>Completa tu cédula y nombre en Ajustes antes de generar</p>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <button
            onClick={handleGenerarGP}
            disabled={!perfilValido || generando}
            style={{
              padding: "12px 22px", background: perfilValido ? C.green : C.border,
              color: perfilValido ? C.white : C.textDim, border: "none", borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: perfilValido ? "pointer" : "not-allowed",
              fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <Icon name="download" color={perfilValido ? C.white : C.textDim} size={17} /> Formulario GP
          </button>
          <button
            onClick={handleGenerarGSP}
            disabled={!perfilValido || generando}
            style={{
              padding: "12px 22px", background: "transparent", color: C.green,
              border: `2px solid ${perfilValido ? C.green + "60" : C.border}`, borderRadius: 10,
              fontSize: 13, fontWeight: 700, cursor: perfilValido ? "pointer" : "not-allowed",
              fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <Icon name="download" color={perfilValido ? C.green : C.textDim} size={17} /> Anexo GSP
          </button>
          <button
            onClick={handleGenerarAmbos}
            disabled={!perfilValido || generando}
            style={{
              padding: "12px 22px", background: "transparent", color: C.textMid,
              border: `1px solid ${C.border}`, borderRadius: 10,
              fontSize: 13, fontWeight: 600, cursor: perfilValido ? "pointer" : "not-allowed",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            {generando ? "Generando..." : "Generar ambos"}
          </button>
        </div>

        {/* Instrucciones */}
        <div style={{ background: C.surface, borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
          <p style={{ color: C.text, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Cómo presentar en sri.gob.ec</p>
          {[
            "Descarga el Formulario GP y el Anexo GSP con los botones de arriba",
            "Entra a sri.gob.ec → Servicios en línea e inicia sesión con tu clave",
            "En el menú de declaraciones busca 'Gastos Personales'",
            "Sube el Formulario GP y el Anexo GSP donde te los pida el sistema",
            "Revisa los montos, confirma el envío y guarda tu número de trámite",
          ].map((paso, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < 4 ? 12 : 0 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 11, background: C.greenAccent,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, fontSize: 11, fontWeight: 800, color: C.white,
              }}>
                {i + 1}
              </div>
              <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.5 }}>{paso}</p>
            </div>
          ))}
        </div>

        <p style={{ color: C.textDim, fontSize: 12, marginBottom: 20 }}>
          Tienes tiempo hasta febrero {anioNum + 1} para presentar esto
        </p>

        {declaracion?.estado === "presentada" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.greenAccent + "12", border: `1px solid ${C.greenAccent}40`, borderRadius: 10, padding: "16px 18px" }}>
            <Icon name="check_circle" color={C.greenAccent} size={22} />
            <div>
              <p style={{ color: C.greenAccent, fontSize: 13, fontWeight: 700 }}>Marcada como presentada</p>
              {declaracion.fecha_presentacion && (
                <p style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>
                  Presentada el {new Date(declaracion.fecha_presentacion + "T12:00:00").toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setMostrarModal(true)}
            style={{
              width: "100%", padding: 13, borderRadius: 10,
              border: `2px solid ${C.greenAccent}`, background: "transparent", color: C.greenAccent,
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Icon name="task_alt" color={C.greenAccent} size={18} /> Marcar como presentada
          </button>
        )}
      </div>

      {/* ─── Modal: Fecha presentación ─── */}
      {mostrarModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ background: C.white, borderRadius: 20, padding: 28, maxWidth: 400, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <p style={{ color: C.text, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Marcar como presentada</p>
            <p style={{ color: C.textMid, fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              ¿Cuándo presentaste tu declaración de gastos personales en el SRI?
            </p>
            <label style={{ color: C.textMid, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 6 }}>
              Fecha de presentación
            </label>
            <input
              type="date"
              value={fechaPresentacion}
              onChange={e => setFechaPresentacion(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", background: C.surface,
                border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text,
                fontSize: 13, outline: "none", fontFamily: "DM Sans, sans-serif",
                boxSizing: "border-box", marginBottom: 20,
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setMostrarModal(false)}
                style={{
                  flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${C.border}`,
                  background: "transparent", color: C.textMid, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={marcarPresentada}
                disabled={guardando}
                style={{
                  flex: 2, padding: 12, borderRadius: 10, border: "none",
                  background: C.greenAccent, color: C.white, fontSize: 13, fontWeight: 700,
                  cursor: guardando ? "not-allowed" : "pointer", fontFamily: "DM Sans, sans-serif",
                }}
              >
                {guardando ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
