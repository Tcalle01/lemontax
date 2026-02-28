import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C, catColors, catIcons, CANASTA } from "../theme";
import Icon from "../components/Icon";
import ObligacionCard from "../components/ObligacionCard";
import { useAuth } from "../auth";
import { useObligaciones } from "../hooks/useObligaciones";
import { usePerfil } from "../hooks/usePerfil";
import { supabase } from "../supabase";

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

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { perfil, onboardingCompletado } = usePerfil();
  const { obligaciones } = useObligaciones();
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("facturas").select("*").eq("user_id", user.id).order("fecha", { ascending: false })
      .then(({ data }) => {
        if (data?.length > 0) {
          setFacturas(data.map(f => ({
            id: f.id, emisor: f.emisor, ruc: f.ruc || "", fecha: f.fecha,
            monto: f.monto, categoria: f.categoria, sri: f.es_deducible_sri,
            esVenta: f.es_venta, comprobantes: f.comprobantes || 1,
          })));
        }
        setLoading(false);
      });
  }, [user]);

  const anioAgp = new Date().getFullYear() - 1;
  const sinClasificarAgp = facturas.filter(
    f => !f.esVenta && f.fecha?.startsWith(String(anioAgp)) && (!f.categoria || f.categoria === "")
  );

  const total = facturas.reduce((a, b) => a + b.monto, 0);
  const deducible = facturas.filter(f => f.sri).reduce((a, b) => a + b.monto, 0);
  const salarioAnual = parseFloat(perfil.salario || 0) * 12;
  const cargas = parseInt(perfil.cargas || 0);
  const rebaja = salarioAnual > 0 ? calcRebaja(deducible, salarioAnual, cargas) : deducible * 0.10;
  const limite = calcLimite(salarioAnual, cargas);
  const catTotals = {};
  facturas.filter(f => f.sri).forEach(f => { catTotals[f.categoria] = (catTotals[f.categoria] || 0) + f.monto; });
  const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Top 3 most urgent obligations (not futura)
  const urgentObligaciones = obligaciones.filter(o => o.estado !== "futura" && o.estado !== "presentada").slice(0, 3);

  if (loading) return (
    <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <p style={{ color: C.textDim, fontSize: 13 }}>Cargando...</p>
    </div>
  );

  return (
    <div style={{ padding: "32px", overflowY: "auto", flex: 1 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>Inicio</h1>
        <p style={{ color: C.textMid, fontSize: 13, marginTop: 4 }}>Todo bien, estás al día · {new Date().getFullYear()}</p>
      </div>

      {/* Onboarding banner (safety net) */}
      {!onboardingCompletado && (
        <div onClick={() => navigate("/ajustes")} style={{ background: C.yellow, borderRadius: 12, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
          <Icon name="bolt" color={C.green} size={24} />
          <div style={{ flex: 1 }}>
            <p style={{ color: C.green, fontSize: 14, fontWeight: 700 }}>Configura tu perfil para ver tus obligaciones personalizadas</p>
            <p style={{ color: C.green, fontSize: 12, opacity: 0.7 }}>Configurar ahora, toma 1 minuto</p>
          </div>
          <Icon name="chevron_right" color={C.green} size={20} />
        </div>
      )}

      {/* Salary warning */}
      {!perfil.salario && onboardingCompletado && (
        <div onClick={() => navigate("/ajustes")} style={{ background: C.yellowDim, border: `1px solid ${C.yellow}40`, borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <Icon name="warning" color={C.green} size={22} />
          <div style={{ flex: 1 }}>
            <p style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>Agrega tu salario para ver tu rebaja exacta</p>
            <p style={{ color: C.textMid, fontSize: 12 }}>Ve a Ajustes para completar tu perfil →</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <StatCard icon="savings" label="Rebaja estimada IR" value={fmt(rebaja)} sub="Basado en gastos deducibles" accent={C.yellow} />
        <StatCard icon="receipt" label="Total gastos" value={fmt(total)} sub={`${facturas.length} facturas registradas`} accent={C.greenAccent} />
        <StatCard icon="check_circle" label="Gastos deducibles" value={fmt(deducible)} sub={`Límite: ${fmt(limite)}`} accent={C.blue} />
        <StatCard icon="bar_chart" label="% del límite usado" value={limite > 0 ? `${Math.min(Math.round(deducible / limite * 100), 100)}%` : "—"} sub="Capacidad de deducción" accent={C.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Obligations widget */}
          {onboardingCompletado && urgentObligaciones.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Próximas obligaciones</p>
                <button onClick={() => navigate("/obligaciones")} style={{ color: C.greenAccent, fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Ver todas →</button>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {urgentObligaciones.map(o => (
                  <ObligacionCard key={o.id} obligacion={o} compact />
                ))}
              </div>
            </div>
          )}

          {/* AGP: facturas sin clasificar */}
          {onboardingCompletado && sinClasificarAgp.length > 0 && (
            <div
              onClick={() => navigate(`/obligaciones/gastos-personales/${anioAgp}`)}
              style={{
                background: C.yellow + "18", border: `1.5px solid ${C.yellow}60`,
                borderRadius: 14, padding: "14px 18px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
              }}
            >
              <Icon name="description" color="#D4A017" size={22} />
              <div style={{ flex: 1 }}>
                <p style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>
                  Tienes {sinClasificarAgp.length} factura{sinClasificarAgp.length !== 1 ? "s" : ""} sin clasificar
                </p>
                <p style={{ color: C.textMid, fontSize: 12, marginTop: 2 }}>
                  Clasifícalas para maximizar tu rebaja en renta {anioAgp}
                </p>
              </div>
              <span style={{ color: C.green, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                Clasificar ahora →
              </span>
            </div>
          )}

          {/* Recent invoices */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>Facturas recientes</p>
              <button onClick={() => navigate("/facturas")} style={{ color: C.greenAccent, fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Ver todas →</button>
            </div>
            {facturas.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center" }}>
                <p style={{ color: C.textDim, fontSize: 13 }}>Sin facturas aún — conecta Gmail para importar</p>
              </div>
            ) : facturas.slice(0, 6).map((f, i) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", padding: "12px 20px", borderBottom: i < Math.min(facturas.length, 6) - 1 ? `1px solid ${C.border}` : "none", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: (catColors[f.categoria] || "#ccc") + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name={catIcons[f.categoria] || "receipt_long"} color={catColors[f.categoria] || "#ccc"} size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.emisor}</p>
                  <p style={{ color: C.textDim, fontSize: 11, marginTop: 2 }}>{f.fecha} · {f.categoria}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{fmt(f.monto)}</p>
                  {f.sri && <Badge color={C.greenAccent}>SRI</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Gastos por categoría</p>
            {topCats.length === 0 ? (
              <p style={{ color: C.textDim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Sin gastos deducibles aún</p>
            ) : topCats.map(([cat, monto]) => (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: C.textMid, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name={catIcons[cat] || "receipt_long"} color={catColors[cat] || C.textDim} size={15} />
                    {cat}
                  </span>
                  <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{fmt(monto)}</span>
                </div>
                <div style={{ height: 5, background: C.border, borderRadius: 3 }}>
                  <div style={{ height: "100%", borderRadius: 3, background: catColors[cat] || C.greenAccent, width: `${deducible > 0 ? Math.min((monto / deducible) * 100, 100) : 0}%`, transition: "width 0.6s ease" }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Acciones rápidas</p>
            {[
              { icon: "mail", label: "Importar facturas desde Gmail", to: "/ajustes" },
              { icon: "assignment", label: "Ver mis obligaciones", to: "/obligaciones" },
              { icon: "receipt_long", label: "Ver todas mis facturas", to: "/facturas" },
            ].map((a, i) => (
              <button key={i} onClick={() => navigate(a.to)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left", marginBottom: 8, fontFamily: "DM Sans, sans-serif" }}>
                <Icon name={a.icon} color={C.textMid} size={18} />
                <span style={{ color: C.textMid, fontSize: 12, fontWeight: 500, flex: 1 }}>{a.label}</span>
                <span style={{ color: C.textDim, fontSize: 12 }}>→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}