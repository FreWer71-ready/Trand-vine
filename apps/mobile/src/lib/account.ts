// Konto: den anonyma användaren blir permanent med e-postkod, så att källaren
// sparas på profilen och går att nå från andra enheter.
//
// - Ny e-post: kopplas till det anonyma kontot (samma id, källaren följer med).
// - E-post som redan har ett konto: logga in på det och flytta den här enhetens
//   flaskor dit med en engångsbiljett.
// Mejlet innehåller en kod om Supabase-mallarna "Magic Link" och "Change Email
// Address" har {{ .Token }}; annars en länk, som på webben loggar in direkt.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { claimTransfer, createTransferTicket } from "./api.ts";
import { supabase } from "./supabase.ts";

const TICKET_KEY = "trandvine.transferTicket";

/** Länken i mejlet leder tillbaka hit (webb). */
const redirectTo = () => (Platform.OS === "web" ? globalThis.location?.origin : undefined);

/**
 * Biljetten sparas på enheten, så att flaskorna flyttas även om man loggar in
 * via länken i mejlet (som öppnar appen på nytt).
 */
export async function claimPendingTransfer() {
  try {
    const ticket = await AsyncStorage.getItem(TICKET_KEY);
    if (!ticket) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user || data.user.is_anonymous) return;
    await AsyncStorage.removeItem(TICKET_KEY);
    await claimTransfer(ticket);
  } catch {
    // Biljetten gäller en timme; misslyckas flytten ligger flaskorna kvar på det anonyma kontot.
  }
}

export type EmailFlow = { mode: "link" } | { mode: "existing"; ticket: string | null };

export async function sendEmailCode(email: string): Promise<EmailFlow> {
  const { data } = await supabase.auth.getUser();
  if (data.user?.is_anonymous) {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirectTo() });
    if (!error) return { mode: "link" };
    if (error.code !== "email_exists") throw error;
    // Kontot finns: ta med den här enhetens flaskor vid inloggningen.
    const ticket = await createTransferTicket();
    if (ticket) await AsyncStorage.setItem(TICKET_KEY, ticket).catch(() => undefined);
    const res = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo() } });
    if (res.error) throw res.error;
    return { mode: "existing", ticket };
  }
  const res = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: redirectTo() } });
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
  if (flow.mode === "existing") await claimPendingTransfer();
}

/** Logga ut; appen startar då en ny anonym session. */
export async function signOut() {
  await supabase.auth.signOut();
  await supabase.auth.signInAnonymously();
}
