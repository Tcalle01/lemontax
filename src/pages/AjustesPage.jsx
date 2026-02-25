import { useState, useEffect } from "react";
import { C, CANASTA, TIPOS_CONTRIBUYENTE } from "../theme";
import Icon from "../components/Icon";
import Onboarding from "../components/Onboarding";
import { useAuth } from "../auth";
import { usePerfil } from "../hooks/usePerfil";
import { supabase } from "../supabase";
import { generarFormularioGP, generarAnexoGSP } from "../sriExport";

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
  return Math.round((Math.min(totalDeducible, limite) / salarioAnual) * ir * 100) / 100;
}

function fmt(n) { return `$${n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

const inputStyle = {
  width: "100%", padding: "10px 14px", background: C.surface,
  border: `1.5px solid ${C.border}`, borderRadius: 10, color: C.text,
  fontSize: 13, outline: "none", fontFamily: "DM Sans, sans-serif",
};
const labelStyle = {
  color: C.textMid, fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: 0.5, marginBottom: 6, display: "block",
};

function formatLastSync(date) {
  if (!date) return "Nunca";
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return "Hace un momento";
  if (diff < 60) return `Hace ${diff} min`;
  if (diff < 1440) return `Hace ${Math.floor(diff / 60)}h`;
  return date.toLocaleDateString("es-EC");
}

export default function AjustesPage() {
  const { user, triggerSync } = useAuth();
  const { perfil, updatePerfil, savePerfil, loading } = usePerfil();
  const [syncStatus, setSyncStatus] = useState("idle");
  const [cambiandoTipo, setCambiandoTipo] = useState(false);
  const [syncGmail, setSyncGmail] = useState("idle");
  const [syncResult, setSyncResult] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("gmail_tokens").select("last_sync").eq("user_id", user.id).maybeSingle(),
      supabase.from("facturas").select("*").eq("user_id", user.id).order("fecha", { ascending: false }),
    ]).then(([{ data: tok }, { data: facs }]) => {
      if (tok?.last_sync) setLastSync(new Date(tok.last_sync));
      if (facs) setFacturas(facs.map(f => ({
        id: f.id, emisor: f.emisor, ruc: f.ruc || "", fecha: f.fecha,
        monto: f.monto, categoria: f.categoria, sri: f.es_deducible_sri,
        comprobantes: f.comprobantes || 1,
      })));
    });
  }, [user]);

  const handleSave = async () => {
    setSyncStatus("saving");
    const ok = await savePerfil();
    setSyncStatus(ok ? "saved" : "error");
    if (ok) setTimeout(() => setSyncStatus("idle"), 2500);
  };

  const handleSync = async () => {
    setSyncGmail("syncing"); setSyncResult(null);
    try {
      const res = await triggerSync();
      const r = res.resultados?.[0];
      setSyncResult({ nuevas: r?.nuevas ?? 0, duplicadas: r?.duplicadas ?? 0, errores: r?.errores ?? 0 });
      setLastSync(new Date());
      setSyncGmail("success");
    } catch (e) {
      setSyncGmail("error"); setSyncResult({ mensaje: e.message || "Error al sincronizar" });
    }
  };

  const catTotals = {};
  facturas.filter(f => f.sri).forEach(f => { catTotals[f.categoria] = (catTotals[f.categoria] || 0) + f.monto; });
  const totalDeducible = Object.values(catTotals).reduce((a, b) => a + b, 0);
  const salarioAnual = parseFloat(perfil.salario || 0) * 12;
  const cargas = parseInt(perfil.cargas || 0);
  const rebaja = salarioAnual > 0 ? calcRebaja(totalDeducible, salarioAnual, cargas) : totalDeducible * 0.10;
  const perfilValido = perfil.cedula && perfil.nombre && perfil.salario;
  const tipoMeta = TIPOS_CONTRIBUYENTE[perfil.tipoContribuyente] || null;

  const handleGenerarAmbos = () => {
    setGenerando(true);
    setTimeout(() => {
      generarFormularioGP({ perfil, facturas, rebaja, salarioAnual, cargas });
      generarAnexoGSP({ perfil, facturas });
      setGenerando(false);
    }, 800);
  };

  if (loading) return (
    <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: C.textDim, fontSize: 13 }}>Cargando...</p>
    </div>
  );

  // Cambio de tipo: overlay con Onboarding
  if (cambiandoTipo) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.bg, borderRadius: 24, overflow: "auto", maxHeight: "90vh", width: "100%", maxWidth: 560, margin: 20 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 20px 0" }}>
          <button onClick={() => setCambiandoTipo(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim }}>
            <Icon name="close" color={C.textDim} size={20} />
          </button>
        </div>
        <Onboarding onComplete={async (data) => {
          await savePerfil({ ...perfil, ...data });
          setCambiandoTipo(false);
        }} soloTipo />
      </div>
    </div>
  );

  return (
    <div style={{ padding: 32, overflowY: "auto", maxWidth: 880 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Ajustes</h1>
        <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Tu perfil tributario y datos personales</p>
      </div>

      {/* ─── Tipo contribuyente ─── */}
      <div style={{ background: C.cardDark, borderRadius: 16, padding: "20px 24px", marginBottom: 20, color: C.white }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon name="person" color={C.yellow} size={18} />
              <span style={{ fontSize: 10, fontWeight: 700, background: C.yellow + "25", color: C.yellow, padding: "2px 8px", borderRadius: 6 }}>
                {perfil.regimen === "rimpe_emprendedor" ? "RIMPE Emprendedor"
                  : perfil.regimen === "rimpe_negocio_popular" ? "RIMPE Negocio Popular"
                  : "Régimen General"}
              </span>
            </div>
            {tipoMeta ? (
              <>
                <p style={{ fontSize: 15, fontWeight: 700, fontFamily: "Syne, sans-serif", marginBottom: 4 }}>{tipoMeta.descripcion}</p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.5 }}>{tipoMeta.detalle}</p>
              </>
            ) : (
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Tipo de contribuyente no configurado</p>
            )}
          </div>
          <button onClick={() => setCambiandoTipo(true)} style={{
            background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8,
            padding: "8px 16px", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 6,
          }}>
            <Icon name="edit" color="rgba(255,255,255,0.7)" size={14} /> Cambiar
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* ─── Datos personales ─── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Datos personales</p>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Cédula o Pasaporte</label>
            <input value={perfil.cedula || ""} onChange={e => updatePerfil("cedula", e.target.value)} placeholder="1700000000" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Apellidos y nombres completos</label>
            <input value={perfil.nombre || ""} onChange={e => updatePerfil("nombre", e.target.value)} placeholder="García Pérez Tomás" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Salario mensual (USD)</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textMid, fontSize: 13 }}>$</span>
              <input type="number" value={perfil.salario || ""} onChange={e => updatePerfil("salario", e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: 28 }} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Ingresos otros empleadores (mensual)</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.textMid, fontSize: 13 }}>$</span>
              <input type="number" value={perfil.otrosIngresos || ""} onChange={e => updatePerfil("otrosIngresos", e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: 28 }} />
            </div>
          </div>
        </div>

        {/* ─── Cargas y condiciones ─── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Cargas y condiciones</p>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Número de cargas familiares</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["0", "1", "2", "3", "4", "5+"].map(n => (
                <button key={n} onClick={() => updatePerfil("cargas", n === "5+" ? "5" : n)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 8,
                  border: `1px solid ${perfil.cargas === (n === "5+" ? "5" : n) ? C.green : C.border}`,
                  background: perfil.cargas === (n === "5+" ? "5" : n) ? C.green : "transparent",
                  color: perfil.cargas === (n === "5+" ? "5" : n) ? C.white : C.textMid,
                  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                }}>{n}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 20 }}>
            <div>
              <p style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Enfermedad catastrófica</p>
              <p style={{ color: C.textDim, fontSize: 11 }}>Persona o carga familiar</p>
            </div>
            <button onClick={() => updatePerfil("enfermedadCatastrofica", !perfil.enfermedadCatastrofica)} style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              background: perfil.enfermedadCatastrofica ? C.greenAccent : C.border, position: "relative", transition: "all 0.2s",
            }}>
              <div style={{ width: 18, height: 18, borderRadius: 9, background: C.white, position: "absolute", top: 3, left: perfil.enfermedadCatastrofica ? 23 : 3, transition: "all 0.2s" }} />
            </button>
          </div>
          {salarioAnual > 0 && (
            <div style={{ background: C.greenAccent + "10", border: `1px solid ${C.greenAccent}30`, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <p style={{ color: C.greenAccent, fontSize: 12, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="bar_chart" color={C.greenAccent} size={16} /> Resumen estimado
              </p>
              {[
                ["Salario anual", fmt(salarioAnual)],
                [`Límite deducible (${cargas} cargas)`, fmt(calcLimite(salarioAnual, cargas))],
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
          <button onClick={handleSave} disabled={syncStatus === "saving"} style={{
            width: "100%", padding: 13, borderRadius: 10, border: "none", cursor: syncStatus === "saving" ? "not-allowed" : "pointer",
            background: syncStatus === "saved" ? C.greenAccent : C.green, color: C.white,
            fontSize: 14, fontWeight: 800, fontFamily: "DM Sans, sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {syncStatus === "saving" ? "Guardando..." : syncStatus === "saved"
              ? <><Icon name="check_circle" color={C.white} size={18} /> Guardado</>
              : <><Icon name="save" color={C.white} size={18} /> Guardar cambios</>}
          </button>
          {syncStatus === "error" && <p style={{ color: C.red, fontSize: 12, marginTop: 8, textAlign: "center" }}>Error al guardar — verifica tu conexión</p>}
        </div>
      </div>

      {/* ─── Gmail sync ─── */}
      <div style={{ background: C.cardDark, borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: "0 2px 12px rgba(26,58,42,0.12)" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="mail" color={C.white} size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ color: C.white, fontSize: 15, fontWeight: 700 }}>Gmail — Sync de facturas</p>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: C.greenAccent + "30", color: C.greenAccent }}>
                <Icon name="check" color={C.greenAccent} size={12} /> Conectado
              </span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 14 }}>
              Último sync: <span style={{ color: "rgba(255,255,255,0.7)" }}>{formatLastSync(lastSync)}</span>
            </p>
            {syncGmail === "syncing" && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 6 }}>Buscando facturas en Gmail...</p>
                <div style={{ height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: C.yellow, borderRadius: 3, width: "60%", animation: "pulse 1.5s ease-in-out infinite" }} />
                </div>
              </div>
            )}
            {syncGmail === "success" && syncResult && (
              <div style={{ background: C.greenAccent + "20", border: `1px solid ${C.greenAccent}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                <p style={{ color: C.greenAccent, fontSize: 13, fontWeight: 700 }}>
                  <Icon name="check_circle" color={C.greenAccent} size={14} /> {syncResult.nuevas} facturas nuevas guardadas
                </p>
                {syncResult.duplicadas > 0 && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 4 }}>{syncResult.duplicadas} ya existían</p>}
              </div>
            )}
            {syncGmail === "error" && syncResult && (
              <div style={{ background: C.red + "20", border: `1px solid ${C.red}40`, borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                <p style={{ color: C.red, fontSize: 13, fontWeight: 700 }}>{syncResult.mensaje}</p>
              </div>
            )}
            <button onClick={handleSync} disabled={syncGmail === "syncing"} style={{
              padding: "10px 22px", background: syncGmail === "syncing" ? "rgba(255,255,255,0.1)" : C.yellow,
              color: syncGmail === "syncing" ? "rgba(255,255,255,0.4)" : C.green,
              border: "none", borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: syncGmail === "syncing" ? "not-allowed" : "pointer",
              fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 8,
            }}>
              <Icon name="sync" color={syncGmail === "syncing" ? "rgba(255,255,255,0.4)" : C.green} size={17}
                style={{ display: "inline-block", animation: syncGmail === "syncing" ? "spin 1s linear infinite" : "none" }} />
              {syncGmail === "syncing" ? "Sincronizando..." : "Sincronizar ahora"}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Declaración ─── */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Declaración anual</p>
        <p style={{ color: C.textMid, fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>Genera tu Formulario GP y Anexo GSP listos para el portal del SRI. Necesitas tener cédula y nombre guardados.</p>
        {!perfilValido ? (
          <div style={{ background: C.yellowDim, border: `1px solid ${C.yellow}40`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <p style={{ color: C.green, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="warning" color={C.green} size={16} /> Completa tu cédula, nombre y salario antes de generar
            </p>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => { if (!perfilValido || generando) return; setGenerando(true); setTimeout(() => { generarFormularioGP({ perfil, facturas, rebaja, salarioAnual, cargas }); setGenerando(false); }, 800); }}
            disabled={!perfilValido || generando}
            style={{ padding: "11px 22px", background: perfilValido ? C.green : C.border, color: perfilValido ? C.white : C.textDim, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: perfilValido ? "pointer" : "not-allowed", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="download" color={perfilValido ? C.white : C.textDim} size={17} /> Formulario GP
          </button>
          <button onClick={() => { if (!perfilValido || generando) return; setGenerando(true); setTimeout(() => { generarAnexoGSP({ perfil, facturas }); setGenerando(false); }, 800); }}
            disabled={!perfilValido || generando}
            style={{ padding: "11px 22px", background: "transparent", color: C.green, border: `2px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: perfilValido ? "pointer" : "not-allowed", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="download" color={C.green} size={17} /> Anexo GSP
          </button>
          <button onClick={handleGenerarAmbos} disabled={!perfilValido || generando}
            style={{ padding: "11px 22px", background: "transparent", color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: perfilValido ? "pointer" : "not-allowed", fontFamily: "DM Sans, sans-serif" }}>
            {generando ? "Generando..." : "Generar ambos"}
          </button>
        </div>
      </div>
    </div>
  );
}
