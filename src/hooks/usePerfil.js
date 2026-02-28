import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { useAuth } from "../auth";
import { TIPOS_CONTRIBUYENTE } from "../theme";

export function usePerfil() {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState({
    cedula: "", nombre: "", salario: "", otrosIngresos: "", cargas: "0",
    enfermedadCatastrofica: false, tipoContribuyente: null, regimen: null,
    novenoDigitoRuc: null, onboardingCompletado: false,
    ingresoMensualDependencia: "",
  });
  const [loading, setLoading] = useState(true);

  const fetchPerfil = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("perfil")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setPerfil({
          cedula: data.cedula || "",
          nombre: data.nombre || "",
          salario: data.salario_mensual?.toString() || "",
          otrosIngresos: data.otros_ingresos?.toString() || "",
          cargas: data.cargas_familiares?.toString() || "0",
          enfermedadCatastrofica: data.enfermedad_catastrofica || false,
          tipoContribuyente: data.tipo_contribuyente || null,
          regimen: data.regimen || null,
          novenoDigitoRuc: data.noveno_digito_ruc || null,
          onboardingCompletado: data.onboarding_completado || false,
          ingresoMensualDependencia: data.ingreso_mensual_dependencia?.toString() || "",
          _id: data.id,
        });
      }
    } catch {
      console.log("Error cargando perfil");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPerfil(); }, [fetchPerfil]);

  const updatePerfil = (k, v) => setPerfil(prev => ({ ...prev, [k]: v }));

  const savePerfil = useCallback(async (perfilToSave) => {
    if (!user) return;
    const p = perfilToSave || perfil;
    const payload = {
      user_id: user.id,
      cedula: p.cedula,
      nombre: p.nombre,
      salario_mensual: parseFloat(p.salario) || 0,
      otros_ingresos: parseFloat(p.otrosIngresos) || 0,
      cargas_familiares: parseInt(p.cargas) || 0,
      enfermedad_catastrofica: p.enfermedadCatastrofica || false,
      tipo_contribuyente: p.tipoContribuyente,
      regimen: p.regimen,
      noveno_digito_ruc: p.novenoDigitoRuc,
      onboarding_completado: p.onboardingCompletado,
      ingreso_mensual_dependencia: parseFloat(p.ingresoMensualDependencia) || null,
    };
    try {
      if (p._id) {
        await supabase.from("perfil").update(payload).eq("id", p._id);
      } else {
        const { data } = await supabase.from("perfil").insert(payload).select().single();
        if (data) setPerfil(prev => ({ ...prev, _id: data.id }));
      }
      return true;
    } catch {
      return false;
    }
  }, [user, perfil]);

  const meta = TIPOS_CONTRIBUYENTE[perfil.tipoContribuyente] || {};

  return {
    perfil,
    tipoContribuyente: perfil.tipoContribuyente,
    descripcion: meta.descripcion || "",
    detalle: meta.detalle || "",
    novenoDigitoRuc: perfil.novenoDigitoRuc,
    regimen: perfil.regimen || meta.regimen || null,
    onboardingCompletado: perfil.onboardingCompletado,
    loading,
    savePerfil,
    updatePerfil,
    refetch: fetchPerfil,
  };
}
