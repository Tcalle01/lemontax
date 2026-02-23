// LoginScreen.jsx — Pantalla de login con Google
import { useState } from "react";
import { useAuth } from "./auth";

const C = {
  bg: "#0D1F14",
  surface: "#132218",
  card: "#1A2E20",
  border: "#243B2A",
  green: "#1A3A2A",
  greenAccent: "#4CAF82",
  yellow: "#F5E642",
  yellowDim: "#F5E64230",
  white: "#FFFFFF",
  text: "#E8F0EA",
  textMid: "#8FA894",
  textDim: "#4A6350",
  red: "#E05252",
};

export default function LoginScreen() {
  const { loginConGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginConGoogle();
      // Supabase redirige automáticamente, no hay que hacer nada más
    } catch (e) {
      setError("No se pudo conectar con Google. Intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      padding: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🍋</div>
          <h1 style={{ color: C.yellow, fontSize: 32, fontWeight: 800, fontFamily: "Syne, sans-serif", lineHeight: 1 }}>
            Lemon Tax
          </h1>
          <p style={{ color: C.textMid, fontSize: 15, marginTop: 10, lineHeight: 1.6 }}>
            Declara tus gastos personales al SRI<br />sin complicaciones
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 20,
          padding: 32,
        }}>
          <h2 style={{ color: C.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Ingresa a tu cuenta
          </h2>
          <p style={{ color: C.textDim, fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
            Conecta tu cuenta de Google para importar automáticamente tus facturas electrónicas del SRI desde Gmail.
          </p>

          {error && (
            <div style={{ background: C.red + "15", border: `1px solid ${C.red}30`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
              <p style={{ color: C.red, fontSize: 13 }}>⚠️ {error}</p>
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px 20px",
              background: loading ? C.border : C.white,
              color: loading ? C.textDim : "#1A1A1A",
              border: "none",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              fontFamily: "DM Sans, sans-serif",
              transition: "all 0.2s",
              marginBottom: 16,
            }}
          >
            {!loading && (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? "Redirigiendo a Google..." : "Continuar con Google"}
          </button>

          {/* Features list */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["📧", "Importa facturas automáticamente desde Gmail"],
              ["🔒", "Tus datos son privados y solo tú los ves"],
              ["📊", "Genera Formulario GP y Anexo GSP en Excel"],
              ["🍋", "Calcula tu rebaja de IR al instante"],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ color: C.textMid, fontSize: 13 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: C.textDim, fontSize: 11, textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
          Al continuar aceptas que Lemon Tax acceda a tu Gmail<br />
          solo para leer facturas electrónicas del SRI.
        </p>
      </div>
    </div>
  );
}
