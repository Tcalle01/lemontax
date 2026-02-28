import { useState, useEffect } from "react";
import { C } from "../theme";
import Icon from "../components/Icon";
import ObligacionCard from "../components/ObligacionCard";
import TarjetaPerfilTributario from "../components/TarjetaPerfilTributario";
import CalendarioObligaciones from "../components/CalendarioObligaciones";
import { useObligaciones } from "../hooks/useObligaciones";
import { useConfiguracionSRI } from "../hooks/useConfiguracionSRI";
import { usePerfil } from "../hooks/usePerfil";
import { useAuth } from "../auth";
import { supabase } from "../supabase";
import { calcularMora } from "../utils/mora";

export default function ObligacionesPage() {
  const { obligaciones, loading } = useObligaciones();
  const { tipoContribuyente, perfil } = usePerfil();
  const { user } = useAuth();
  const { config: sriConfig } = useConfiguracionSRI();

  const [sinClasificarCount, setSinClasificarCount] = useState(0);
  const [agpPresentada, setAgpPresentada] = useState(false);
  const [vista, setVista] = useState("lista");
  const [moraMap, setMoraMap] = useState({}); // { [obligacion.id]: moraResult }

  // ── AGP state (existing) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const anioAgp = new Date().getFullYear() - 1;
    Promise.allSettled([
      supabase.from("facturas")
        .select("id, categoria, es_venta, fecha")
        .eq("user_id", user.id)
        .gte("fecha", `${anioAgp}-01-01`)
        .lte("fecha", `${anioAgp}-12-31`),
      supabase.from("declaraciones_agp")
        .select("estado")
        .eq("user_id", user.id)
        .eq("anio_fiscal", anioAgp)
        .maybeSingle(),
    ]).then(([facRes, decRes]) => {
      if (facRes.status === "fulfilled" && facRes.value.data) {
        const count = facRes.value.data.filter(
          f => f.es_venta !== true && (!f.categoria || f.categoria === "")
        ).length;
        setSinClasificarCount(count);
      }
      if (decRes.status === "fulfilled" && decRes.value.data?.estado === "presentada") {
        setAgpPresentada(true);
      }
    });
  }, [user]);

  // ── Mora calculation for vencidas ─────────────────────────────────────────
  useEffect(() => {
    if (!user || !obligaciones.length) return;
    const vencidas = obligaciones.filter(o => o.estado === "vencida");
    if (!vencidas.length) return;

    const anio = new Date().getFullYear();
    const salarioAnual = parseFloat(perfil?.salario || 0) * 12;

    Promise.allSettled([
      // All IVA declarations (any period)
      supabase.from("declaraciones_iva")
        .select("periodo, valor_pagar, total_ventas")
        .eq("user_id", user.id),
      // IR declaration for last year
      supabase.from("declaraciones_ir")
        .select("anio_fiscal, ir_a_pagar, ingresos_facturacion, ingresos_dependencia, ingresos_otros")
        .eq("user_id", user.id),
      // All facturas for current + last year (for ventas data)
      supabase.from("facturas")
        .select("fecha, monto, es_venta, tarifa_iva")
        .eq("user_id", user.id)
        .eq("es_venta", true)
        .gte("fecha", `${anio - 1}-01-01`),
    ]).then(([ivaRes, irRes, facRes]) => {
      const decIva = (ivaRes.status === "fulfilled" ? ivaRes.value.data : null) || [];
      const decIr  = (irRes.status  === "fulfilled" ? irRes.value.data  : null) || [];
      const ventasFacturas = (facRes.status === "fulfilled" ? facRes.value.data : null) || [];

      // Build ventas totals per period key
      const ventasPorMes = {}; // "YYYY-MM" → total base
      const ventasPorAnio = {}; // "YYYY" → total base
      for (const f of ventasFacturas) {
        if (!f.fecha) continue;
        const mes = f.fecha.slice(0, 7);  // "YYYY-MM"
        const yr  = f.fecha.slice(0, 4);  // "YYYY"
        ventasPorMes[mes]  = (ventasPorMes[mes]  || 0) + (f.monto || 0);
        ventasPorAnio[yr]  = (ventasPorAnio[yr]  || 0) + (f.monto || 0);
      }

      const result = {};

      for (const ob of vencidas) {
        let impuestoCausado = 0;
        let ventasPeriodo = 0;
        let ingresosBrutos = 0;

        if (ob.tipo === "iva_mensual") {
          // periodo key: "YYYY-MM"
          const periodoKey = ob.id.replace("iva_mensual_", "").replace("_", "-"); // "2024_11" → "2024-11"
          const dec = decIva.find(d => d.periodo === periodoKey);
          impuestoCausado = Math.max(dec?.valor_pagar ?? 0, 0);
          ventasPeriodo = dec?.total_ventas ?? ventasPorMes[periodoKey] ?? 0;

        } else if (ob.tipo === "iva_semestral") {
          // id: "iva_semestral_2024_S1"
          const parts = ob.id.split("_"); // ["iva","semestral","2024","S1"]
          const periodoKey = `${parts[2]}-${parts[3]}`; // "2024-S1"
          const dec = decIva.find(d => d.periodo === periodoKey);
          impuestoCausado = Math.max(dec?.valor_pagar ?? 0, 0);
          // Ventas del semestre
          const yr = parts[2];
          const meses = parts[3] === "S1"
            ? ["01","02","03","04","05","06"]
            : ["07","08","09","10","11","12"];
          ventasPeriodo = meses.reduce((s, m) => s + (ventasPorMes[`${yr}-${m}`] || 0), 0);
          if (dec?.total_ventas) ventasPeriodo = dec.total_ventas;

        } else if (ob.tipo === "ir_anual" || ob.tipo === "ir_anual_rimpe") {
          // ob.id: "ir_anual_2024"
          const anioFiscal = parseInt(ob.id.split("_").pop());
          const dec = decIr.find(d => d.anio_fiscal === anioFiscal);
          impuestoCausado = Math.max(dec?.ir_a_pagar ?? 0, 0);
          const ventasAnio = ventasPorAnio[String(anioFiscal)] || 0;
          ingresosBrutos = salarioAnual + ventasAnio +
            parseFloat(dec?.ingresos_otros ?? 0);

        } else if (ob.tipo === "agp") {
          // Fixed $30, no financial data needed
        }

        result[ob.id] = calcularMora({
          tipoObligacion: ob.tipo,
          fechaVencimiento: ob.fechaVencimiento,
          impuestoCausado,
          ventasPeriodo,
          ingresosBrutos,
          config: sriConfig,
        });
      }

      setMoraMap(result);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, obligaciones, sriConfig]);

  // ── Enrich AGP obligation ─────────────────────────────────────────────────
  const enrichedObligaciones = obligaciones.map(o => {
    if (o.tipo !== "agp") return o;
    const ctaLabel = agpPresentada
      ? "Ver detalle"
      : sinClasificarCount > 0
      ? `Clasificar mis facturas (${sinClasificarCount} pendientes)`
      : "Ver resumen y generar formularios";
    const estado = agpPresentada ? "presentada" : o.estado;
    return { ...o, ctaLabel, estado };
  });

  const vencidasUrgentes = enrichedObligaciones.filter(o => o.estado === "vencida" || o.estado === "urgente");
  const pendientes = enrichedObligaciones.filter(o => o.estado === "pendiente");
  const futuras = enrichedObligaciones.filter(o => o.estado === "futura");
  const presentadas = enrichedObligaciones.filter(o => o.estado === "presentada");

  if (loading) return (
    <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: C.textDim, fontSize: 13 }}>Cargando...</p>
    </div>
  );

  return (
    <div style={{ padding: 32, overflowY: "auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Mis Obligaciones</h1>
          <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Tus obligaciones tributarias personalizadas</p>
        </div>

        {/* ── Vista toggle ── */}
        {tipoContribuyente && enrichedObligaciones.length > 0 && (
          <div style={{
            display: "flex", background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: 3, gap: 2,
          }}>
            <button
              onClick={() => setVista("lista")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: vista === "lista" ? C.white : "transparent",
                color: vista === "lista" ? C.green : C.textMid,
                fontSize: 12, fontWeight: 700, fontFamily: "DM Sans, sans-serif",
                boxShadow: vista === "lista" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >
              <Icon name="format_list_bulleted" color={vista === "lista" ? C.green : C.textMid} size={16} />
              Lista
            </button>
            <button
              onClick={() => setVista("calendario")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: vista === "calendario" ? C.white : "transparent",
                color: vista === "calendario" ? C.green : C.textMid,
                fontSize: 12, fontWeight: 700, fontFamily: "DM Sans, sans-serif",
                boxShadow: vista === "calendario" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >
              <Icon name="calendar_month" color={vista === "calendario" ? C.green : C.textMid} size={16} />
              Calendario
            </button>
          </div>
        )}
      </div>

      <TarjetaPerfilTributario />

      {!tipoContribuyente ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
          <Icon name="assignment" color={C.textDim} size={40} />
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>Sin perfil tributario configurado</p>
          <p style={{ color: C.textMid, fontSize: 13 }}>Completa tu perfil para ver tus obligaciones personalizadas.</p>
        </div>
      ) : enrichedObligaciones.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
          <Icon name="check_circle" color={C.greenAccent} size={40} />
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>Todo al día</p>
          <p style={{ color: C.textMid, fontSize: 13 }}>No tienes obligaciones pendientes por ahora.</p>
        </div>
      ) : vista === "calendario" ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <CalendarioObligaciones obligaciones={enrichedObligaciones} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {vencidasUrgentes.length > 0 && (
            <Section titulo="Requieren atención" color={C.red} iconName="warning">
              {vencidasUrgentes.map(o => (
                <ObligacionCard
                  key={o.id}
                  obligacion={o}
                  mora={o.estado === "vencida" ? moraMap[o.id] : undefined}
                />
              ))}
            </Section>
          )}
          {pendientes.length > 0 && (
            <Section titulo="Próximas" color={C.textMid} iconName="schedule">
              {pendientes.map(o => <ObligacionCard key={o.id} obligacion={o} />)}
            </Section>
          )}
          {futuras.length > 0 && (
            <Section titulo="Futuras" color={C.textDim} iconName="event">
              {futuras.map(o => <ObligacionCard key={o.id} obligacion={o} />)}
            </Section>
          )}
          {presentadas.length > 0 && (
            <Section titulo="Presentadas" color={C.greenAccent} iconName="check_circle">
              {presentadas.map(o => <ObligacionCard key={o.id} obligacion={o} />)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ titulo, color, iconName, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name={iconName} color={color} size={16} />
        <p style={{ color, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{titulo}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}
