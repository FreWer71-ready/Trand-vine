import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Locale } from "@trand-vine/core";
import { getProfile, type Profile } from "./api.ts";
import { LOGIN_ENABLED } from "./config.ts";
import { deviceLocale } from "./i18n.tsx";
import { supabase } from "./supabase.ts";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Fel vid anonym inloggning, t.ex. om den inte är påslagen i Supabase. */
  error: string | null;
  locale: Locale;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    setProfile(await getProfile().catch(() => null));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      let current = data.session;
      if (!current && !LOGIN_ENABLED) {
        const res = await supabase.auth.signInAnonymously();
        if (res.error) setError(res.error.message);
        current = res.data.session;
      }
      setSession(current);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) void refreshProfile();
    else setProfile(null);
  }, [session?.user.id, refreshProfile]);

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, error, locale: profile?.locale ?? deviceLocale(), refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth utanför AuthProvider");
  return ctx;
}
