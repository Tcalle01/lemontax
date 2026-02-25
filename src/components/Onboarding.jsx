import { useState } from "react";
import { C, TIPOS_CONTRIBUYENTE } from "../theme";
import Icon from "./Icon";
import { useAuth } from "../auth";

export default function Onboarding({ onComplete }) {
  const { logout } = useAuth();
  const [step, setStep] = useState(0);
  const [tieneRuc, setTieneRuc] = useState(null); // null | true | false
  const [situacion, setSituacion] = useState(null);
  const [facturacion, setFacturacion] = useState(null); // null | "bajo" | "medio" | "alto"
  const [novenoDigito, setNovenoDigito] = useState("");
  const [saving, setSaving] = useState(false);

  // Determine if step 2 (revenue) is needed
  const necesitaPasoFacturacion = situacion === "freelancer" || situacion === "negocio";

  const handleFinish = async () => {
    // Calculate tipo_contribuyente
    let tipo;
    if (situacion === "dependencia") tipo = "dependencia_pura";
    else if (situacion === "dependencia_extras") tipo = "dependencia_con_extras";
    else if (situacion === "freelancer") tipo = "freelancer_general";
    else if (situacion === "negocio" && facturacion === "bajo") tipo = "rimpe_negocio_popular";
    else if (situacion === "negocio" && facturacion === "medio") tipo = "rimpe_emprendedor";
    else if (situacion === "arriendo") tipo = "arrendador_general";

    const regimen = TIPOS_CONTRIBUYENTE[tipo]?.regimen || "general";

    setSaving(true);
    await onComplete({
      tipoContribuyente: tipo,
      regimen,
      novenoDigitoRuc: novenoDigito || null,
      onboardingCompletado: true,
    });
    setSaving(false);
  };

  const nextStep = () => setStep(s => s + 1);

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:hover { opacity: 0.88; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <svg width="40" height="40" viewBox="0 0 56 56" fill="none">
            <rect width="56" height="56" rx="16" fill="#F5E642"/>
            <path d="M14 28.5L23.5 38L42 19" stroke="#1A3A2A" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p style={{ color: C.green, fontSize: 16, fontWeight: 800, fontFamily: "Syne, sans-serif", marginTop: 8 }}>facilito</p>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= step ? C.green : C.border,
              transition: "all 0.3s",
            }} />
          ))}
        </div>

        {/* Step 0: ¿Tienes RUC? */}
        {step === 0 && (
          <div>
            <h2 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 8 }}>
              ¿Tienes RUC activo?
            </h2>
            <p style={{ color: C.textMid, fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
              Para usar facilito necesitas tener un RUC activo en el SRI.
            </p>

            {tieneRuc === false ? (
              <div style={{ background: C.surface, borderRadius: 16, padding: 24, border: `1px solid ${C.border}` }}>
                <Icon name="info" color={C.blue} size={28} />
                <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 8 }}>
                  Primero necesitas obtener tu RUC
                </h3>
                <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
                  El RUC (Registro Único de Contribuyentes) es tu identificación tributaria. Puedes obtenerlo en cualquier agencia del SRI o en línea.
                </p>
                <a
                  href="https://www.sri.gob.ec"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    width: "100%", padding: 14, background: C.green, color: C.white,
                    borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: "none", marginBottom: 12,
                  }}
                >
                  <Icon name="open_in_new" color={C.white} size={16} /> Ir al portal del SRI
                </a>
                <button onClick={logout} style={{
                  width: "100%", padding: 14, background: "transparent", color: C.textMid,
                  border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                }}>
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button onClick={() => { setTieneRuc(true); nextStep(); }} style={{
                  width: "100%", padding: 18, background: C.white, color: C.green,
                  border: `2px solid ${C.border}`, borderRadius: 16, fontSize: 16, fontWeight: 700,
                  cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 12,
                }}>
                  <Icon name="check_circle" color={C.greenAccent} size={24} /> Sí, tengo RUC
                </button>
                <button onClick={() => setTieneRuc(false)} style={{
                  width: "100%", padding: 18, background: C.white, color: C.green,
                  border: `2px solid ${C.border}`, borderRadius: 16, fontSize: 16, fontWeight: 700,
                  cursor: "pointer", fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", gap: 12,
                }}>
                  <Icon name="cancel" color={C.textDim} size={24} /> No tengo RUC
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Situación */}
        {step === 1 && (
          <div>
            <h2 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 8 }}>
              ¿Cómo describes tu situación?
            </h2>
            <p style={{ color: C.textMid, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              Esto nos ayuda a mostrarte solo las obligaciones que te corresponden.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { id: "dependencia", icon: "work", title: "Trabajo en relación de dependencia", desc: "Tienes empleo fijo con rol de pagos. Tu empresa ya retiene tus impuestos." },
                { id: "dependencia_extras", icon: "work_history", title: "Dependencia y también facturo", desc: "Tienes empleo fijo pero además tienes ingresos extras como freelancer o arriendo." },
                { id: "freelancer", icon: "computer", title: "Freelancer o profesional independiente", desc: "Prestas servicios por tu cuenta: diseñador, médico, consultor, programador, etc." },
                { id: "negocio", icon: "storefront", title: "Tengo un negocio o tienda", desc: "Tienes un comercio, restaurante, taller u otro tipo de negocio." },
                { id: "arriendo", icon: "home_work", title: "Arriendo uno o más inmuebles", desc: "Recibes ingresos por arrendar casas, departamentos o locales." },
              ].map(opt => (
                <button key={opt.id} onClick={() => {
                  setSituacion(opt.id);
                  if (opt.id === "freelancer" || opt.id === "negocio") {
                    setStep(2);
                  } else {
                    setStep(3); // Skip facturacion step
                  }
                }} style={{
                  width: "100%", padding: "16px 18px", background: C.white,
                  border: `2px solid ${situacion === opt.id ? C.green : C.border}`,
                  borderRadius: 14, cursor: "pointer", textAlign: "left",
                  display: "flex", alignItems: "flex-start", gap: 14,
                  fontFamily: "DM Sans, sans-serif", transition: "all 0.15s",
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name={opt.icon} color={C.green} size={22} />
                  </div>
                  <div>
                    <p style={{ color: C.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{opt.title}</p>
                    <p style={{ color: C.textMid, fontSize: 12, lineHeight: 1.5 }}>{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Facturación (solo para freelancer/negocio) */}
        {step === 2 && necesitaPasoFacturacion && (
          <div>
            <h2 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 8 }}>
              ¿Cuánto facturas al año aproximadamente?
            </h2>
            <p style={{ color: C.textMid, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              Esto determina tu régimen tributario y las obligaciones que te corresponden.
            </p>

            {facturacion === "alto" ? (
              <div style={{ background: C.surface, borderRadius: 16, padding: 24, border: `1px solid ${C.border}` }}>
                <Icon name="account_balance" color={C.orange} size={28} />
                <h3 style={{ color: C.text, fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 8 }}>
                  Necesitas un contador profesional
                </h3>
                <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
                  Para tu nivel de ingresos necesitas un contador con firma autorizada. facilito puede ayudarte a organizar tus documentos, pero te recomendamos trabajar con un profesional contable.
                </p>
                <button onClick={() => setFacturacion(null)} style={{
                  width: "100%", padding: 14, background: C.green, color: C.white,
                  border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                }}>
                  Elegir otra opción
                </button>
                <button onClick={logout} style={{
                  width: "100%", padding: 14, background: "transparent", color: C.textMid,
                  border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif", marginTop: 10,
                }}>
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { id: "bajo", label: "Menos de $20,000", desc: "Régimen RIMPE Negocio Popular — obligaciones simplificadas" },
                  { id: "medio", label: "Entre $20,001 y $300,000", desc: "Régimen RIMPE Emprendedor — IVA semestral y renta anual" },
                  { id: "alto", label: "Más de $300,000", desc: "Régimen General — requiere firma de contador autorizado" },
                ].map(opt => (
                  <button key={opt.id} onClick={() => {
                    setFacturacion(opt.id);
                    if (opt.id !== "alto") setStep(3);
                  }} style={{
                    width: "100%", padding: "16px 18px", background: C.white,
                    border: `2px solid ${C.border}`, borderRadius: 14,
                    cursor: "pointer", textAlign: "left", fontFamily: "DM Sans, sans-serif",
                  }}>
                    <p style={{ color: C.text, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{opt.label}</p>
                    <p style={{ color: C.textMid, fontSize: 12 }}>{opt.desc}</p>
                  </button>
                ))}
                <button onClick={() => setStep(1)} style={{
                  padding: "10px", background: "transparent", border: "none", color: C.textMid,
                  fontSize: 13, cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                }}>
                  ← Volver
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Noveno dígito RUC */}
        {step === 3 && (
          <div>
            <h2 style={{ color: C.text, fontSize: 24, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 8 }}>
              ¿Cuál es el noveno dígito de tu RUC?
            </h2>
            <p style={{ color: C.textMid, fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
              Con este dígito calculamos tus fechas exactas de vencimiento.
            </p>

            {/* RUC example diagram */}
            <div style={{ background: C.surface, borderRadius: 14, padding: "20px 24px", marginBottom: 24, border: `1px solid ${C.border}` }}>
              <p style={{ color: C.textMid, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Ejemplo de RUC</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, fontFamily: "monospace" }}>
                {["1", "7", "1", "2", "3", "4", "5", "6", "7"].map((d, i) => (
                  <div key={i} style={{
                    width: 32, height: 40, borderRadius: 6,
                    background: i === 8 ? C.yellow : C.white,
                    border: i === 8 ? `2px solid ${C.green}` : `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: i === 8 ? 800 : 500,
                    color: i === 8 ? C.green : C.textMid,
                  }}>{d}</div>
                ))}
                <div style={{ width: 32, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: C.textDim }}>0</div>
                <div style={{ width: 32, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: C.textDim }}>0</div>
                <div style={{ width: 32, height: 40, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: C.textDim }}>1</div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon name="arrow_upward" color={C.green} size={16} />
                  <span style={{ color: C.green, fontSize: 12, fontWeight: 700 }}>Este es el noveno dígito</span>
                </div>
              </div>
            </div>

            {/* Digit input */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 28 }}>
              {["1","2","3","4","5","6","7","8","9","0"].map(d => (
                <button key={d} onClick={() => setNovenoDigito(d)} style={{
                  width: 44, height: 48, borderRadius: 10,
                  background: novenoDigito === d ? C.green : C.white,
                  color: novenoDigito === d ? C.white : C.green,
                  border: novenoDigito === d ? "none" : `2px solid ${C.border}`,
                  fontSize: 18, fontWeight: 800, cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif", transition: "all 0.15s",
                }}>{d}</button>
              ))}
            </div>

            <button
              onClick={handleFinish}
              disabled={!novenoDigito || saving}
              style={{
                width: "100%", padding: 16, background: !novenoDigito ? C.border : C.green,
                color: !novenoDigito ? C.textDim : C.white,
                border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700,
                cursor: !novenoDigito ? "not-allowed" : "pointer",
                fontFamily: "DM Sans, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {saving ? "Guardando..." : "Completar configuración"}
            </button>

            <button onClick={() => setStep(necesitaPasoFacturacion ? 2 : 1)} style={{
              width: "100%", padding: "10px", background: "transparent", border: "none", color: C.textMid,
              fontSize: 13, cursor: "pointer", fontFamily: "DM Sans, sans-serif", marginTop: 10,
            }}>
              ← Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
