import { useState, useEffect } from "react";
import { C } from "../theme";
import Icon from "../components/Icon";
import ObligacionCard from "../components/ObligacionCard";
import TarjetaPerfilTributario from "../components/TarjetaPerfilTributario";
import { useObligaciones } from "../hooks/useObligaciones";
import { usePerfil } from "../hooks/usePerfil";
import { useAuth } from "../auth";
import { supabase } from "../supabase";

export default function ObligacionesPage() {
  const { obligaciones, loading } = useObligaciones();
  const { tipoContribuyente } = usePerfil();
  const { user } = useAuth();
  const [sinClasificarCount, setSinClasificarCount] = useState(0);
  const [agpPresentada, setAgpPresentada] = useState(false);

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

  // Enrich AGP obligation with dynamic CTA label and estado
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
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Mis Obligaciones</h1>
        <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Tus obligaciones tributarias personalizadas</p>
      </div>

      <TarjetaPerfilTributario />

      {!tipoContribuyente ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
          <Icon name="assignment" color={C.textDim} size={40} />
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>Sin perfil tributario configurado</p>
          <p style={{ color: C.textMid, fontSize: 13 }}>Completa tu perfil para ver tus obligaciones personalizadas.</p>
        </div>
      ) : obligaciones.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
          <Icon name="check_circle" color={C.greenAccent} size={40} />
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>Todo al día</p>
          <p style={{ color: C.textMid, fontSize: 13 }}>No tienes obligaciones pendientes por ahora.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {vencidasUrgentes.length > 0 && (
            <Section titulo="Requieren atención" color={C.red} iconName="warning">
              {vencidasUrgentes.map(o => <ObligacionCard key={o.id} obligacion={o} />)}
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
