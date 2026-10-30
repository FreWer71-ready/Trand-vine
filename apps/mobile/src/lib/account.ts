// Konto: den anonyma användaren blir permanent med e-postkod, så att källaren
// sparas på profilen och går att nå från andra enheter.
//
// - Ny e-post: kopplas till det anonyma kontot (samma id, källaren följer med).
// - E-post som redan har ett konto: logga in på det och flytta den här enhetens
//   flaskor dit med en engångsbiljett.
// Supabase-mallarna "Magic Link" och "Change Email Address" ska innehålla {{ .Token }}.

import { claimTransfer, createTransferTicket } from "./api.ts";
import { supabase } from "./supabase.ts";

export type EmailFlow = { mode: "link" } | { mode: "existing"; ticket: string | null };

export async function sendEmailCode(email: string): Promise<EmailFlow> {
  const { data } = await supabase.auth.getUser();
  if (data.user?.is_anonymous) {
    const { error } = await supabase.auth.updateUser({ email });
    if (!error) return { mode: "link" };
    if (error.code !== "email_exists") throw error;
    // Kontot finns: ta med den här enhetens flaskor vid inloggningen.
    const ticket = await createTransferTicket();
    const res = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (res.error) throw res.error;
    return { mode: "existing", ticket };
  }
  const res = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (res.error) throw res.error;
  return { mode: "existing", ticket: null };
}

export async function verifyEmailCode(email: string, code: string, flow: EmailFlow) {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: flow.mode === "link" ? "email_change" : "email",
  });
  if (error) throw error;
  if (flow.mode === "existing" && flow.ticket) await claimTransfer(flow.ticket);
}

/** Logga ut; appen startar då en ny anonym session. */
export async function signOut() {
  await supabase.auth.signOut();
  await supabase.auth.signInAnonymously();
}
