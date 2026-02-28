import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../theme";
import Icon from "../components/Icon";
import { useObligaciones } from "../hooks/useObligaciones";
import { useConfiguracionSRI } from "../hooks/useConfiguracionSRI";
import { usePerfil } from "../hooks/usePerfil";
import { useAuth } from "../auth";
import { supabase } from "../supabase";
import { calcularMora, CONFIG_SRI_DEFAULTS } from "../utils/mora";

function fmt(n) {
  return `$${Number(n).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({ label, value, highlight }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0" }}>
      <span style={{ color: highlight ? C.text : C.textMid, fontSize: 12, fontWeight: highlight ? 600 : 400 }}>{label}</span>
      <span style={{ color: highlight ? C.red : C.textMid, fontSize: 13, fontWeight: highlight ? 700 : 400 }}>{value}</span>
    </div>
  );
}

export default function CuantoDeboPage() {
  const navigate = useNavigate();
  const { obligaciones, loading: obLoading } = useObligaciones();
  const { perfil } = usePerfil();
  const { user } = useAuth();
  const { config: sriConfig, loading: configLoading } = useConfiguracionSRI();
  const [items, setItems] = useState([]); // enriched vencidas
  const [dataLoading, setDataLoading] = useState(true);

  const vencidas = obligaciones.filter(o => o.estado === "vencida");

  useEffect(() => {
    if (obLoading || configLoading || !user || !vencidas.length) {
      if (!obLoading && !configLoading) setDataLoading(false);
      return;
    }

    const anio = new Date().getFullYear();
    const salarioAnual = parseFloat(perfil?.salario || 0) * 12;

    Promise.allSettled([
      supabase.from("declaraciones_iva")
        .select("periodo, valor_pagar, total_ventas")
        .eq("user_id", user.id),
      supabase.from("declaraciones_ir")
        .select("anio_fiscal, ir_a_pagar, ingresos_otros")
        .eq("user_id", user.id),
      supabase.from("facturas")
        .select("fecha, monto, es_venta")
        .eq("user_id", user.id)
        .eq("es_venta", true)
        .gte("fecha", `${anio - 1}-01-01`),
    ]).then(([ivaRes, irRes, facRes]) => {
      const decIva = (ivaRes.status === "fulfilled" ? ivaRes.value.data : null) || [];
      const decIr  = (irRes.status  === "fulfilled" ? irRes.value.data  : null) || [];
      const ventasFacturas = (facRes.status === "fulfilled" ? facRes.value.data : null) || [];

      // Ventas totals per month and year
      const ventasPorMes = {};
      const ventasPorAnio = {};
      for (const f of ventasFacturas) {
        if (!f.fecha) continue;
        const mes = f.fecha.slice(0, 7);
        const yr  = f.fecha.slice(0, 4);
        ventasPorMes[mes]  = (ventasPorMes[mes]  || 0) + (f.monto || 0);
        ventasPorAnio[yr]  = (ventasPorAnio[yr]  || 0) + (f.monto || 0);
      }

      const enriched = vencidas.map(ob => {
        let impuestoCausado = 0;
        let ventasPeriodo = 0;
        let ingresosBrutos = 0;
        let periodoLabel = ob.descripcion;

        if (ob.tipo === "iva_mensual") {
          const periodoKey = ob.id.replace("iva_mensual_", "").replace("_", "-");
          const dec = decIva.find(d => d.periodo === periodoKey);
          impuestoCausado = Math.max(dec?.valor_pagar ?? 0, 0);
          ventasPeriodo = dec?.total_ventas ?? ventasPorMes[periodoKey] ?? 0;

        } else if (ob.tipo === "iva_semestral") {
          const parts = ob.id.split("_"); // ["iva","semestral","2024","S1"]
          const periodoKey = `${parts[2]}-${parts[3]}`;
          const dec = decIva.find(d => d.periodo === periodoKey);
          impuestoCausado = Math.max(dec?.valor_pagar ?? 0, 0);
          const yr = parts[2];
          const meses = parts[3] === "S1"
            ? ["01","02","03","04","05","06"]
            : ["07","08","09","10","11","12"];
          ventasPeriodo = meses.reduce((s, m) => s + (ventasPorMes[`${yr}-${m}`] || 0), 0);
          if (dec?.total_ventas) ventasPeriodo = dec.total_ventas;

        } else if (ob.tipo === "ir_anual" || ob.tipo === "ir_anual_rimpe") {
          const anioFiscal = parseInt(ob.id.split("_").pop());
          const dec = decIr.find(d => d.anio_fiscal === anioFiscal);
          impuestoCausado = Math.max(dec?.ir_a_pagar ?? 0, 0);
          const ventasAnio = ventasPorAnio[String(anioFiscal)] || 0;
          ingresosBrutos = salarioAnual + ventasAnio + parseFloat(dec?.ingresos_otros ?? 0);
        }

        const mora = calcularMora({
          tipoObligacion: ob.tipo,
          fechaVencimiento: ob.fechaVencimiento,
          impuestoCausado,
          ventasPeriodo,
          ingresosBrutos,
          config: sriConfig,
        });

        return { ...ob, mora, impuestoCausado, ventasPeriodo, ingresosBrutos, periodoLabel };
      });

      setItems(enriched);
      setDataLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obLoading, configLoading, user, sriConfig]);

  const totalMoraGlobal = items.reduce((s, it) => s + (it.mora?.totalMora ?? 0), 0);
  const totalAPagarGlobal = items.reduce((s, it) => s + (it.mora?.totalAPagar ?? 0), 0);
  const isLoading = obLoading || dataLoading;

  return (
    <div style={{ padding: 32, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <Icon name="arrow_back" color={C.textMid} size={18} />
        </button>
        <div>
          <h1 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>¿Cuánto debo?</h1>
          <p style={{ color: C.textMid, fontSize: 13, marginTop: 2 }}>Mora estimada al día de hoy por obligaciones vencidas</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <p style={{ color: C.textDim, fontSize: 13 }}>Calculando mora...</p>
        </div>
      ) : items.length === 0 ? (
        <div style={{ background: C.greenAccent + "10", border: `1px solid ${C.greenAccent}40`, borderRadius: 16, padding: 40, textAlign: "center" }}>
          <Icon name="check_circle" color={C.greenAccent} size={48} />
          <p style={{ color: C.text, fontSize: 16, fontWeight: 700, marginTop: 16 }}>Sin obligaciones vencidas</p>
          <p style={{ color: C.textMid, fontSize: 13, marginTop: 6 }}>Estás al día con el SRI. ¡Bien hecho!</p>
        </div>
      ) : (
        <>
          {/* Global total card */}
          <div style={{
            background: C.cardDark, borderRadius: 16, padding: "24px 28px",
            marginBottom: 24, boxShadow: "0 4px 20px rgba(26,58,42,0.15)",
          }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              Deuda total estimada al {new Date().toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <p style={{ color: C.yellow, fontSize: 36, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>
              {fmt(totalAPagarGlobal)}
            </p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 6 }}>
              Incluye {fmt(totalMoraGlobal)} de mora acumulada
            </p>
            <button
              onClick={() => navigate("/obligaciones")}
              style={{
                marginTop: 16, background: C.yellow, color: C.green,
                border: "none", borderRadius: 10, padding: "10px 20px",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              Presenta ahora para dejar de acumular mora →
            </button>
          </div>

          {/* Individual obligations */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {items.map(item => (
              <DeudaCard key={item.id} item={item} onNavigate={() => navigate(item.ruta)} />
            ))}
          </div>

          {/* Disclaimer */}
          <div style={{
            marginTop: 28, padding: "16px 20px",
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
          }}>
            <p style={{ color: C.textDim, fontSize: 11, lineHeight: 1.6 }}>
              <strong style={{ color: C.textMid }}>Cálculo referencial.</strong>{" "}
              Basado en Art. 100 LRTI (multas) y Art. 21 Código Tributario (intereses).
              La tasa de interés vigente ({CONFIG_SRI_DEFAULTS.trimestre_vigente}) es{" "}
              {CONFIG_SRI_DEFAULTS.tasa_mora_voluntaria_mensual}% mensual según BCE.
              El valor exacto lo determinará el SRI al momento de presentar tu declaración.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function DeudaCard({ item, onNavigate }) {
  const { mora, nombre, descripcion, tipo } = item;
  const esAgp = tipo === "agp";
  const esIr = tipo === "ir_anual" || tipo === "ir_anual_rimpe";

  return (
    <div
      onClick={onNavigate}
      style={{
        background: C.white, border: `1.5px solid ${C.red}30`,
        borderRadius: 14, padding: "18px 20px", cursor: "pointer",
        transition: "box-shadow 0.15s",
      }}
    >
      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <p style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>{nombre}</p>
          <p style={{ color: C.textMid, fontSize: 12, marginTop: 2 }}>{descripcion}</p>
          <p style={{ color: C.red, fontSize: 11, marginTop: 3 }}>
            {mora.diasMora} días de mora · {mora.mesesMora} mes(es)
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ color: C.red, fontSize: 18, fontWeight: 800, fontFamily: "Syne, sans-serif" }}>
            {mora.desconocido ? "—" : fmt(mora.totalMora)}
          </p>
          <p style={{ color: C.textDim, fontSize: 10, marginTop: 2 }}>mora estimada</p>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ background: C.surface, borderRadius: 8, padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
        {mora.desconocido ? (
          <p style={{ color: C.textMid, fontSize: 11 }}>
            {esIr
              ? "Multa pendiente — completa tu declaración de renta para calcularla"
              : "Datos insuficientes para calcular multa"}
          </p>
        ) : (
          <>
            {item.impuestoCausado > 0 && (
              <Row label="Impuesto causado" value={fmt(item.impuestoCausado)} />
            )}
            {mora.multa > 0 && (
              <Row label={`Multa · ${mora.detalleMulta}`} value={fmt(mora.multa)} />
            )}
            {mora.intereses > 0 && (
              <Row label={`Intereses · ${mora.detalleInteres}`} value={fmt(mora.intereses)} />
            )}
            <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 4 }}>
              <Row label="Total a pagar (estimado)" value={fmt(mora.totalAPagar)} highlight />
            </div>
          </>
        )}

        {/* AGP and IVA sin ventas notes */}
        {esAgp && (
          <p style={{ color: C.greenAccent, fontSize: 11, fontWeight: 600, marginTop: 6 }}>
            La multa del AGP es fija — no aumenta con el tiempo
          </p>
        )}
        {(tipo === "iva_mensual" || tipo === "iva_semestral") && item.ventasPeriodo === 0 && !mora.desconocido && (
          <p style={{ color: C.textMid, fontSize: 11, marginTop: 6 }}>
            Sin ventas en el período — presenta ahora, solo debes {fmt(mora.multa)} de multa fija
          </p>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <span style={{ color: C.red, fontSize: 12, fontWeight: 600 }}>Presentar y reducir mora →</span>
      </div>
    </div>
  );
}
