import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import { usePerfil } from "./hooks/usePerfil";
import { useIsMobile } from "./hooks/useIsMobile";
import LoginScreen from "./LoginScreen";
import Onboarding from "./components/Onboarding";
import DesktopLayout from "./layouts/DesktopLayout";
import MobileLayout from "./layouts/MobileLayout";
import DashboardPage from "./pages/DashboardPage";
import ObligacionesPage from "./pages/ObligacionesPage";
import ObligacionDetallePage from "./pages/ObligacionDetallePage";
import IvaDeclaracionPage from "./pages/IvaDeclaracionPage";
import IvaSemestralPage from "./pages/IvaSemestralPage";
import GastosPersonalesPage from "./pages/GastosPersonalesPage";
import FacturasPage from "./pages/FacturasPage";
import HistorialPage from "./pages/HistorialPage";
import AjustesPage from "./pages/AjustesPage";
import ProyeccionIRPage from "./pages/ProyeccionIRPage";
import DeclaracionIRPage from "./pages/DeclaracionIRPage";

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh", background: "#FFFFFF",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 12, fontFamily: "Syne, sans-serif",
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

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { onboardingCompletado, loading: perfilLoading, perfil, savePerfil } = usePerfil();

  if (authLoading || (user && perfilLoading)) return <LoadingScreen />;

  if (!user) return <LoginScreen />;

  if (!onboardingCompletado) {
    return (
      <Onboarding
        onComplete={async (data) => {
          await savePerfil({ ...perfil, ...data });
        }}
      />
    );
  }

  const Layout = isMobile ? MobileLayout : DesktopLayout;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/obligaciones" element={<ObligacionesPage />} />
          <Route path="/obligaciones/iva/:year/:mes" element={<IvaDeclaracionPage />} />
          <Route path="/obligaciones/iva-semestral/:anio/:semestre" element={<IvaSemestralPage />} />
          <Route path="/obligaciones/gastos-personales/:anio" element={<GastosPersonalesPage />} />
          <Route path="/obligaciones/renta/:anio" element={<DeclaracionIRPage />} />
          <Route path="/obligaciones/:tipo/:year/:periodo" element={<ObligacionDetallePage />} />
          <Route path="/obligaciones/:tipo/:year" element={<ObligacionDetallePage />} />
          <Route path="/proyeccion-ir" element={<ProyeccionIRPage />} />
          <Route path="/facturas" element={<FacturasPage />} />
          <Route path="/historial" element={<HistorialPage />} />
          <Route path="/ajustes" element={<AjustesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
