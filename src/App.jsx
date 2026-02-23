import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./auth";
import LoginScreen from "./LoginScreen";
import LemonTaxMobile from "./LemonTaxMobile";
import LemonTaxDesktop from "./LemonTaxDesktop";

function AppContent() {
  const { user, loading } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0D1F14",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 12,
        fontFamily: "sans-serif",
      }}>
        <span style={{ fontSize: 48 }}>🍋</span>
        <p style={{ color: "#F5E642", fontSize: 20, fontWeight: 800 }}>Lemon Tax</p>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Cargando...</p>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return isMobile ? <LemonTaxMobile /> : <LemonTaxDesktop />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
