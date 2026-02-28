import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../theme";
import Icon from "./Icon";

// Color dot per estado
const dotColor = {
  vencida: C.red,
  urgente: "#D4A017",
  pendiente: C.textMid,
  futura: C.border,
  presentada: C.greenAccent,
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIAS_SEM = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function getDiasEnMes(anio, mes) {
  return new Date(anio, mes + 1, 0).getDate();
}

// Monday-first: 0=Lu ... 6=Do
function primerDiaDelMes(anio, mes) {
  const d = new Date(anio, mes, 1).getDay(); // 0=Su ... 6=Sa
  return (d + 6) % 7;
}

export default function CalendarioObligaciones({ obligaciones }) {
  const navigate = useNavigate();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth()); // 0-indexed
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  const diasEnMes = getDiasEnMes(anio, mes);
  const offsetInicio = primerDiaDelMes(anio, mes);

  // Build map: "YYYY-MM-DD" → [obligacion, ...]
  const mapaObs = {};
  for (const ob of obligaciones) {
    const f = ob.fechaVencimiento;
    const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
    if (!mapaObs[key]) mapaObs[key] = [];
    mapaObs[key].push(ob);
  }

  function keyForDia(dia) {
    return `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }

  function irAnterior() {
    if (mes === 0) { setAnio(a => a - 1); setMes(11); }
    else setMes(m => m - 1);
    setDiaSeleccionado(null);
  }

  function irSiguiente() {
    if (mes === 11) { setAnio(a => a + 1); setMes(0); }
    else setMes(m => m + 1);
    setDiaSeleccionado(null);
  }

  function handleDiaClick(dia) {
    const key = keyForDia(dia);
    if (!mapaObs[key]) return;
    setDiaSeleccionado(diaSeleccionado === dia ? null : dia);
  }

  const esHoy = (dia) =>
    dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();

  const obsDelDia = diaSeleccionado ? (mapaObs[keyForDia(diaSeleccionado)] || []) : [];

  // Priority color for the dot in a day (worst estado wins)
  function prioridadColor(obs) {
    if (obs.some(o => o.estado === "vencida")) return dotColor.vencida;
    if (obs.some(o => o.estado === "urgente")) return dotColor.urgente;
    if (obs.some(o => o.estado === "pendiente")) return dotColor.pendiente;
    if (obs.some(o => o.estado === "presentada")) return dotColor.presentada;
    return dotColor.futura;
  }

  const celdas = [];
  // Blank cells before first day
  for (let i = 0; i < offsetInicio; i++) {
    celdas.push(null);
  }
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push(d);
  }

  return (
    <div>
      {/* ── Header navigation ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20,
      }}>
        <button onClick={irAnterior} style={navBtnStyle}>
          <Icon name="chevron_left" color={C.textMid} size={20} />
        </button>
        <p style={{ color: C.text, fontSize: 16, fontWeight: 700, fontFamily: "Syne, sans-serif" }}>
          {MESES[mes]} {anio}
        </p>
        <button onClick={irSiguiente} style={navBtnStyle}>
          <Icon name="chevron_right" color={C.textMid} size={20} />
        </button>
      </div>

      {/* ── Day-of-week headers ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 8 }}>
        {DIAS_SEM.map(d => (
          <div key={d} style={{ textAlign: "center", color: C.textDim, fontSize: 11, fontWeight: 700, paddingBottom: 4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {celdas.map((dia, i) => {
          if (!dia) return <div key={`blank-${i}`} />;
          const key = keyForDia(dia);
          const obsHoy = mapaObs[key] || [];
          const tieneObs = obsHoy.length > 0;
          const isSelected = diaSeleccionado === dia;
          const isToday = esHoy(dia);

          return (
            <div
              key={dia}
              onClick={() => handleDiaClick(dia)}
              style={{
                position: "relative",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 3,
                borderRadius: 10,
                padding: "8px 4px",
                minHeight: 48,
                cursor: tieneObs ? "pointer" : "default",
                background: isSelected
                  ? C.green
                  : isToday
                  ? C.yellowDim
                  : tieneObs ? C.surface : "transparent",
                border: isToday && !isSelected ? `1.5px solid ${C.yellow}` : "1.5px solid transparent",
                transition: "background 0.15s",
              }}
            >
              <span style={{
                fontSize: 13, fontWeight: isToday ? 800 : 500,
                color: isSelected ? C.white : isToday ? C.green : tieneObs ? C.text : C.textDim,
              }}>
                {dia}
              </span>
              {/* Dots row */}
              {tieneObs && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
                  {obsHoy.slice(0, 3).map((ob, idx) => (
                    <div key={idx} style={{
                      width: 6, height: 6, borderRadius: 3,
                      background: isSelected ? "rgba(255,255,255,0.8)" : dotColor[ob.estado] || C.textDim,
                    }} />
                  ))}
                  {obsHoy.length > 3 && (
                    <div style={{
                      width: 6, height: 6, borderRadius: 3,
                      background: isSelected ? "rgba(255,255,255,0.5)" : C.textDim,
                    }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Legend ── */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
        {[
          { label: "Vencida", color: dotColor.vencida },
          { label: "Urgente", color: dotColor.urgente },
          { label: "Pendiente", color: dotColor.pendiente },
          { label: "Presentada", color: dotColor.presentada },
          { label: "Futura", color: dotColor.futura },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: color, border: color === dotColor.futura ? `1px solid ${C.border}` : "none" }} />
            <span style={{ color: C.textDim, fontSize: 11 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Detail panel for selected day ── */}
      {diaSeleccionado && obsDelDia.length > 0 && (
        <div style={{
          marginTop: 20, background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: "16px 20px",
        }}>
          <p style={{ color: C.textMid, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
            {diaSeleccionado} de {MESES[mes]}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {obsDelDia.map(ob => {
              const cfg = estadoMini[ob.estado] || estadoMini.pendiente;
              return (
                <div
                  key={ob.id}
                  onClick={() => navigate(ob.ruta)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 10,
                    background: cfg.bg, border: `1px solid ${cfg.border}`,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: dotColor[ob.estado], flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{ob.nombre}</p>
                    <p style={{ color: C.textMid, fontSize: 11, marginTop: 2 }}>{ob.descripcion}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: cfg.labelColor, padding: "2px 8px", borderRadius: 6, background: cfg.labelBg }}>
                      {cfg.label}
                    </span>
                    <Icon name="chevron_right" color={C.textDim} size={16} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtnStyle = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
  width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer",
};

const estadoMini = {
  vencida:   { bg: C.red + "08",         border: C.red + "30",         label: "Vencida",    labelColor: C.red,        labelBg: C.red + "15" },
  urgente:   { bg: "#D4A01710",           border: "#D4A01730",           label: "Urgente",    labelColor: "#D4A017",    labelBg: "#D4A01715" },
  pendiente: { bg: C.white,              border: C.border,              label: "Pendiente",  labelColor: C.textMid,    labelBg: C.surface },
  futura:    { bg: C.surface,            border: C.border,              label: "Futura",     labelColor: C.textDim,    labelBg: C.border + "50" },
  presentada:{ bg: C.greenAccent + "08", border: C.greenAccent + "40",  label: "Presentada", labelColor: C.greenAccent, labelBg: C.greenAccent + "15" },
};
