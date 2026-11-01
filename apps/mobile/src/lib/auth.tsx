import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Locale } from "@trand-vine/core";
import { claimPendingTransfer } from "./account.ts";
import { isAdminEntry } from "./adminEntry.ts";
import { getProfile, isAdmin, type Profile } from "./api.ts";
import { deviceLocale } from "./i18n.tsx";
import { supabase } from "./supabase.ts";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Fel vid anonym inloggning, t.ex. om den inte är påslagen i Supabase. */
  error: string | null;
  locale: Locale;
  /** Har löst in en inbjudningskod (eller är admin). */
  approved: boolean;
  admin: boolean;
  /** Webbappen öppnades på /admin: ingen anonym session, egen inloggning. */
  adminEntry: boolean;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [adminEntry] = useState(isAdminEntry);

  const refreshProfile = useCallback(async () => {
    await claimPendingTransfer();
    const [p, a] = await Promise.all([getProfile().catch(() => null), isAdmin().catch(() => false)]);
    setProfile(p);
    setAdmin(a);
    setProfileLoaded(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      let current = data.session;
      if (!current && !adminEntry) {
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
    setProfileLoaded(false);
    if (session) void refreshProfile();
    else setProfile(null);
  }, [session?.user.id, refreshProfile]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading: loading || (!!session && !profileLoaded),
        error,
        locale: profile?.locale ?? deviceLocale(),
        approved: !!profile?.approved_at || admin,
        admin,
        adminEntry,
        refreshProfile,
      }}
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
