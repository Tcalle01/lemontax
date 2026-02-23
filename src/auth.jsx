// src/auth.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const guardarRefreshToken = async (userId, refreshToken) => {
    if (!refreshToken) return;
    await supabase.from("gmail_tokens").upsert(
      { user_id: userId, refresh_token: refreshToken },
      { onConflict: "user_id" }
    );
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.provider_refresh_token) {
        guardarRefreshToken(session.user.id, session.provider_refresh_token);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.provider_refresh_token) {
        guardarRefreshToken(session.user.id, session.provider_refresh_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginConGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        scopes: "https://www.googleapis.com/auth/gmail.readonly",
      },
    });
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const getGmailToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.provider_token || null;
  };

  const triggerSync = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("No hay sesión activa");
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-sync`,
      {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error en sync");
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginConGoogle, logout, getGmailToken, triggerSync }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}