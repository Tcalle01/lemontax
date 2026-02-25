import { C } from "../theme";
import Icon from "../components/Icon";
import ObligacionCard from "../components/ObligacionCard";
import TarjetaPerfilTributario from "../components/TarjetaPerfilTributario";
import { useObligaciones } from "../hooks/useObligaciones";
import { usePerfil } from "../hooks/usePerfil";

export default function ObligacionesPage() {
  const { obligaciones, loading } = useObligaciones();
  const { tipoContribuyente } = usePerfil();

  const vencidasUrgentes = obligaciones.filter(o => o.estado === "vencida" || o.estado === "urgente");
  const pendientes = obligaciones.filter(o => o.estado === "pendiente");
  const futuras = obligaciones.filter(o => o.estado === "futura");
  const presentadas = obligaciones.filter(o => o.estado === "presentada");

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
