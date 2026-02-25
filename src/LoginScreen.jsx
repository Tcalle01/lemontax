// LoginScreen.jsx — facilito
import { useState } from "react";
import { useAuth } from "./auth";

const C = {
  bg: "#FFFFFF", surface: "#F7FAF8", card: "#FFFFFF", border: "#E0E8E2",
  green: "#1A3A2A", greenMid: "#2D5A3D", greenAccent: "#4CAF82",
  yellow: "#F5E642", yellowDim: "#F5E64230",
  white: "#FFFFFF", text: "#1A2E20", textMid: "#5A7A64", textDim: "#8FA894",
  red: "#E05252", blue: "#52A8E0",
};

// Logo SVG — checkmark redondeado
function FacilitoLogo({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <rect width="56" height="56" rx="16" fill="#F5E642"/>
      <path d="M14 28.5L23.5 38L42 19" stroke="#1A3A2A" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Icon({ name, color, size = 20 }) {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: size, color: color || C.green, verticalAlign: "middle", lineHeight: 1 }}>
      {name}
    </span>
  );
}

// Onboarding de 3 pasos
function OnboardingStep({ step, onNext }) {
  const steps = [
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M24 4C13 4 4 13 4 24s9 20 20 20 20-9 20-20S35 4 24 4z" fill="#F5E64220"/>
          <path d="M14 24.5L21.5 32L34 18" stroke="#F5E642" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      title: "Declarar, facilito.",
      body: "Te ayudamos a cumplir con tu declaración de impuestos sin estrés ni enredos.",
      cta: "Empezar",
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M24 4C13 4 4 13 4 24s9 20 20 20 20-9 20-20S35 4 24 4z" fill="#F5E64220"/>
          <path d="M24 14v4M24 30v4M14 24h4M30 24h4" stroke="#F5E642" strokeWidth="3" strokeLinecap="round"/>
          <path d="M17 17l2.8 2.8M28.2 28.2L31 31M17 31l2.8-2.8M28.2 19.8L31 17" stroke="#F5E642" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      ),
      title: "Nosotros organizamos tus facturas",
      body: "Nos conectamos automáticamente para obtener tus facturas desde Gmail, sin que tengas que buscarlas.",
      cta: "Continuar",
    },
    {
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M24 4C13 4 4 13 4 24s9 20 20 20 20-9 20-20S35 4 24 4z" fill="#F5E64220"/>
          <path d="M16 24l6 6 10-12" stroke="#4CAF82" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      title: "Paga solo lo justo",
      body: "Te ayudamos a deducir al máximo tus impuestos y te avisamos cuando toque declarar.",
      cta: "Crear mi cuenta",
    },
  ];

  const s = steps[step];

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>{s.icon}</div>
      <h2 style={{ color: C.text, fontSize: 22, fontWeight: 800, fontFamily: "Syne, sans-serif", marginBottom: 12 }}>{s.title}</h2>
      <p style={{ color: C.textMid, fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>{s.body}</p>
      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 28 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i === step ? C.green : C.border, transition: "all 0.3s" }} />
        ))}
      </div>
      <button onClick={onNext} style={{
        width: "100%", padding: "14px", background: C.yellow, color: C.green,
        border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800,
        cursor: "pointer", fontFamily: "DM Sans, sans-serif",
      }}>
        {s.cta}
      </button>
    </div>
  );
}

export default function LoginScreen() {
  const { loginConGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [onboardingStep, setOnboardingStep] = useState(0); // 0-2 onboarding, 3 = login
  const [showLogin, setShowLogin] = useState(false);

  const handleOnboardingNext = () => {
    if (onboardingStep < 2) {
      setOnboardingStep(s => s + 1);
    } else {
      setShowLogin(true);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginConGoogle();
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", padding: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:hover { opacity: 0.88; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo + nombre */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <FacilitoLogo size={52} />
          </div>
          <h1 style={{ color: C.green, fontSize: 30, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>
            facilito
          </h1>
          <p style={{ color: C.textDim, fontSize: 13, marginTop: 6 }}>
            La forma más fácil de declarar impuestos en Ecuador
          </p>
        </div>

        {/* Card */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          {!showLogin ? (
            <OnboardingStep step={onboardingStep} onNext={handleOnboardingNext} />
          ) : (
            <>
              <h2 style={{ color: C.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                Todo bien, casi listo
              </h2>
              <p style={{ color: C.textDim, fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
                Conecta tu cuenta de Google para que facilito organice tus facturas automáticamente.
              </p>

              {error && (
                <div style={{ background: C.red + "15", border: `1px solid ${C.red}30`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="warning" color={C.red} size={18} />
                  <p style={{ color: C.red, fontSize: 13 }}>{error}</p>
                </div>
              )}

              <button onClick={handleLogin} disabled={loading} style={{
                width: "100%", padding: "14px 20px",
                background: loading ? C.border : C.white,
                color: loading ? C.textDim : "#1A1A1A",
                border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 15, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                fontFamily: "DM Sans, sans-serif", marginBottom: 20,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}>
                {!loading && (
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                {loading ? "Abriendo Google..." : "Continuar con Google"}
              </button>

              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["check", C.greenAccent, "Tus facturas organizadas solas"],
                  ["sync",  C.yellow,      "Sync automático cada 12 horas"],
                  ["lock",  C.blue,        "Solo tú ves tus datos"],
                  ["check", C.greenAccent, "Formulario GP listo en un clic"],
                ].map(([type, color, text], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      {type === "check" && <path d="M5 13l4 4L19 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
                      {type === "sync"  && <path d="M12 4v4l-3-3m3 11v4l3-3M4 12h4l-3 3m11-3h4l-3-3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}
                      {type === "lock"  && <><rect x="5" y="11" width="14" height="10" rx="2" stroke={color} strokeWidth="2"/><path d="M8 11V7a4 4 0 018 0v4" stroke={color} strokeWidth="2" strokeLinecap="round"/></>}
                    </svg>
                    <span style={{ color: C.textMid, fontSize: 13 }}>{text}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <p style={{ color: C.textDim, fontSize: 11, textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
          {showLogin
            ? "Solo leemos tus facturas electrónicas, nada más. facilito."
            : "SRI? facilito."}
        </p>
      </div>
    </div>
  );
}
