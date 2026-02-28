import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { CONFIG_SRI_DEFAULTS } from "../utils/mora";

/**
 * Loads SRI configuration from the `configuracion_sri` table.
 * Falls back to hardcoded defaults if the table doesn't exist or is empty.
 */
export function useConfiguracionSRI() {
  const [config, setConfig] = useState(CONFIG_SRI_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("configuracion_sri")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setConfig({ ...CONFIG_SRI_DEFAULTS, ...data });
      })
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}
