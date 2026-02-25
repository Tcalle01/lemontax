import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./auth.jsx";
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
        background: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 12,
        fontFamily: "Syne, sans-serif",
      }}>
        <svg width="52" height="52" viewBox="0 0 56 56" fill="none">
          <rect width="56" height="56" rx="16" fill="#F5E642"/>
          <path d="M14 28.5L23.5 38L42 19" stroke="#1A3A2A" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p style={{ color: "#1A3A2A", fontSize: 20, fontWeight: 800 }}>facilito</p>
        <p style={{ color: "#8FA894", fontSize: 12 }}>Cargando...</p>
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
