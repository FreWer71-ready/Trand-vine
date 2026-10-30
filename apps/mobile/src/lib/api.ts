// Dataåtkomst mot Supabase. Alla frågor går under användarens inloggning,
// så RLS i databasen avgör vad som syns.

import { openFoodFactsProvider } from "@trand-vine/core";
import type {
  AcquisitionType,
  BottleStatus,
  FoodKey,
  LookupResult,
  WineCandidate,
  WineColor,
} from "@trand-vine/core";
import { supabase } from "./supabase.ts";

export interface WineRow {
  id: string;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  color: WineColor | null;
  grapes: string[];
  abv: number | null;
  food_pairings: FoodKey[];
  image_url: string | null;
  systembolaget_nr: string | null;
}

export interface VintageRow {
  id: string;
  wine_id: string;
  year: number | null;
  avg_rating: number | null;
  rating_count: number;
  wines: WineRow;
}

export interface BottleRow {
  id: string;
  vintage_id: string;
  size_ml: number;
  quantity: number;
  acquisition_type: AcquisitionType;
  acquired_at: string | null;
  price: number | null;
  currency: string | null;
  store: string | null;
  gift_from: string | null;
  occasion_note: string | null;
  location: string | null;
  status: BottleStatus;
  consumed_at: string | null;
  consumed_with: string | null;
  consumed_food: string | null;
  rating: number | null;
  notes: string | null;
  created_at: string;
  vintages: VintageRow;
}

export interface HistoryRow {
  bottle_id: string;
  year: number | null;
  status: BottleStatus;
  acquisition_type: AcquisitionType;
  acquired_at: string | null;
  gift_from: string | null;
  consumed_at: string | null;
  consumed_with: string | null;
  consumed_food: string | null;
  rating: number | null;
  notes: string | null;
}

export type ScanResult = LookupResult & { registryMatches?: WineRow[] };

const BOTTLE_SELECT = "*, vintages(*, wines(*))";
const UNIQUE_VIOLATION = "23505";

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function lookupBarcode(barcode: string): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke<ScanResult>("lookup-barcode", {
    body: { barcode },
  });
  if (error || !data) throw new Error(error?.message ?? "lookup failed");
  return data;
}

export interface LabelReadResult {
  text: string;
  display: string;
  vintage: number | null;
  matches: WineRow[];
}

/** Fel från etikettläsningen som visas med egen text. */
export class LabelError extends Error {
  constructor(public code: "not_configured" | "quota" | "failed") {
    super(code);
  }
}

/** Skickar ett foto av etiketten (base64-jpeg) till Google Vision via read-label. */
export async function readLabel(imageBase64: string): Promise<LabelReadResult> {
  const { data, error } = await supabase.functions.invoke<LabelReadResult & { error?: string }>("read-label", {
    body: { image: imageBase64 },
  });
  if (error) {
    // Funktionen svarar med en felkod i JSON även vid 4xx/5xx.
    const ctx = (error as { context?: Response }).context;
    const code = await ctx?.json?.().then((b: { error?: string }) => b.error).catch(() => undefined);
    throw new LabelError(code === "not_configured" || code === "quota" ? code : "failed");
  }
  if (!data) throw new LabelError("failed");
  return data;
}

export async function getWine(id: string): Promise<WineRow> {
  return check(await supabase.from("wines").select("*").eq("id", id).single()) as WineRow;
}

/**
 * Gör om en inklistrad länk från systembolaget.se till artikelnumret, t.ex.
 * ".../produkt/vin/amarone-5570901/" → "5570901". Annan text lämnas orörd.
 */
export function searchTerm(q: string): string {
  const url = q.match(/systembolaget\.se\/\S*?(\d{5,9})\/?(?:[?#]\S*)?$/i);
  return url ? url[1]! : q.trim();
}

export async function searchWines(q: string): Promise<WineRow[]> {
  const term = searchTerm(q);
  if (term.length < 2) return [];
  return (check(await supabase.rpc("search_wines", { q: term, max_results: 20 })) ?? []) as WineRow[];
}

export interface SystembolagetOffer {
  wine_id: string;
  short_number: string;
  vintage: number | null;
  volume_ml: number | null;
  price: number | null;
}

/** Systembolagets nummer, pris, storlek och årgång för vinerna som har sådana. */
export async function systembolagetOffers(wines: WineRow[]): Promise<Map<string, SystembolagetOffer>> {
  const ids = wines.filter((w) => w.systembolaget_nr).map((w) => w.id);
  if (!ids.length) return new Map();
  const rows = check(
    await supabase.from("systembolaget_products").select("wine_id, short_number, vintage, volume_ml, price").in("wine_id", ids),
  ) as SystembolagetOffer[];
  return new Map(rows.map((r) => [r.wine_id, r]));
}

// Reserv när registret saknar vinet. Körs från klienten så att varje
// användare har sin egen sökgräns hos Open Food Facts (10/min).
const off = openFoodFactsProvider();

export async function searchExternal(q: string): Promise<WineCandidate[]> {
  if (q.trim().length < 3) return [];
  return off.search!(q.trim());
}

export interface WdEntry {
  wikidata_id: string;
  name_en: string | null;
  name_sv: string | null;
  origin_country?: string | null;
  country?: string | null;
  wiki_en: string | null;
  wiki_sv: string | null;
}

/** Druvor och områden från Wikidata som matchar vinets druvor och område (namn och synonymer). */
export async function wikidataLookup(grapes: string[], places: string[]): Promise<{ grapes: WdEntry[]; regions: WdEntry[] }> {
  const { data, error } = await supabase.rpc("wikidata_lookup", { grape_names: grapes, place_names: places });
  if (error || !data) return { grapes: [], regions: [] };
  return data as { grapes: WdEntry[]; regions: WdEntry[] };
}

export async function wineHistory(wineId: string): Promise<HistoryRow[]> {
  return (check(await supabase.rpc("my_wine_history", { target_wine: wineId })) ?? []) as HistoryRow[];
}

export async function wineRating(wineId: string): Promise<{ avg_rating: number; rating_count: number } | null> {
  return check(
    await supabase.from("wine_ratings").select("avg_rating, rating_count").eq("wine_id", wineId).maybeSingle(),
  );
}

/** Skapar ett nytt vin i registret från en extern källa eller manuell inmatning. */
export async function createWine(c: Pick<WineCandidate, "name" | "producer" | "country" | "region" | "color" | "grapes" | "abv" | "imageUrl">): Promise<WineRow> {
  const { data: { user } } = await supabase.auth.getUser();
  return check(
    await supabase
      .from("wines")
      .insert({
        name: c.name,
        producer: c.producer ?? null,
        country: c.country ?? null,
        region: c.region ?? null,
        color: c.color ?? null,
        grapes: c.grapes ?? [],
        abv: c.abv ?? null,
        image_url: c.imageUrl ?? null,
        created_by: user?.id,
      })
      .select("*")
      .single(),
  ) as WineRow;
}

/** Hämtar eller skapar årgången. Hanterar att någon annan skapat den samtidigt. */
export async function ensureVintage(wineId: string, year: number | null): Promise<string> {
  const find = async () => {
    const q = supabase.from("vintages").select("id").eq("wine_id", wineId);
    const { data } = await (year === null ? q.is("year", null) : q.eq("year", year)).maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  };
  const existing = await find();
  if (existing) return existing;
  const { data, error } = await supabase.from("vintages").insert({ wine_id: wineId, year }).select("id").single();
  if (error?.code === UNIQUE_VIOLATION) return (await find())!;
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** Sparar kopplingen streckkod → vin så att nästa skanning ger direkt träff. */
export async function linkBarcode(ean: string, wineId: string, source: string, sizeMl?: number) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("wine_barcodes").insert({
    ean,
    wine_id: wineId,
    source,
    bottle_size_ml: sizeMl ?? null,
    confirmed_by: user?.id,
  });
  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
}

export interface NewBottle {
  vintage_id: string;
  size_ml: number;
  quantity: number;
  acquisition_type: AcquisitionType;
  acquired_at?: string | null;
  price?: number | null;
  currency?: string | null;
  store?: string | null;
  gift_from?: string | null;
  occasion_note?: string | null;
  location?: string | null;
}

export async function createBottle(b: NewBottle): Promise<string> {
  return (check(await supabase.from("bottles").insert(b).select("id").single()) as { id: string }).id;
}

export async function getBottle(id: string): Promise<BottleRow> {
  return check(await supabase.from("bottles").select(BOTTLE_SELECT).eq("id", id).single()) as BottleRow;
}

export async function listBottles(statuses: BottleStatus[]): Promise<BottleRow[]> {
  return check(
    await supabase
      .from("bottles")
      .select(BOTTLE_SELECT)
      .in("status", statuses)
      .order("consumed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ) as BottleRow[];
}

export interface TakeBottle {
  status: "consumed" | "given_away";
  consumed_at: string;
  consumed_with?: string | null;
  consumed_food?: string | null;
  rating?: number | null;
  notes?: string | null;
}

/**
 * Tar en flaska ur en post (drucken eller bortgiven). Finns fler kvar minskas
 * antalet och den uttagna flaskan blir en egen rad. Returnerar dess id.
 */
export async function takeBottle(id: string, t: TakeBottle): Promise<string> {
  return check(
    await supabase.rpc("take_bottle", {
      target: id,
      new_status: t.status,
      on_date: t.consumed_at,
      with_whom: t.consumed_with ?? null,
      food: t.consumed_food ?? null,
      score: t.rating ?? null,
      note: t.notes ?? null,
    }),
  ) as string;
}

export async function updateBottle(id: string, patch: Partial<Omit<BottleRow, "id" | "vintages">>) {
  check(await supabase.from("bottles").update(patch).eq("id", id));
}

export interface Profile {
  id: string;
  display_name: string;
  locale: "sv" | "en";
  /** Satt när inbjudningskoden lösts in (eller av admin). */
  approved_at: string | null;
  invite_code: string | null;
}

// Inbjudningskod och konto -----------------------------------------------------

export type RedeemResult = "ok" | "invalid" | "used_up" | "expired" | "too_many_attempts";

export async function redeemInvite(code: string): Promise<RedeemResult> {
  return check(await supabase.rpc("redeem_invite", { input: code })) as RedeemResult;
}

export async function isAdmin(): Promise<boolean> {
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}

/** Biljett som låter ett befintligt konto ta över den anonyma enhetens flaskor. */
export async function createTransferTicket(): Promise<string | null> {
  const { data } = await supabase.rpc("create_transfer_ticket");
  return (data as string | null) ?? null;
}

export async function claimTransfer(ticket: string): Promise<number> {
  const { data } = await supabase.rpc("claim_transfer", { input: ticket });
  return (data as number | null) ?? 0;
}

// Admin ---------------------------------------------------------------------

export interface InviteCode {
  code: string;
  note: string | null;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  anonymous: boolean;
  approved_at: string | null;
  invite_code: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  bottles: number;
}

export interface AdminOverview {
  stats: { users: number; approved: number; bottles: number; wines: number };
  codes: InviteCode[];
  users: AdminUser[];
}

export async function adminOverview(): Promise<AdminOverview> {
  return check(await supabase.rpc("admin_overview")) as AdminOverview;
}

export async function adminCreateCode(c: { code?: string; note?: string; maxUses?: number | null }): Promise<string> {
  return check(
    await supabase.rpc("admin_create_code", {
      new_code: c.code?.trim() || null,
      note: c.note?.trim() || null,
      max_uses: c.maxUses ?? null,
      expires_at: null,
    }),
  ) as string;
}

export async function adminSetCodeActive(code: string, active: boolean) {
  check(await supabase.rpc("admin_set_code_active", { target: code, is_active: active }));
}

export async function adminSetUserAccess(userId: string, access: boolean) {
  check(await supabase.rpc("admin_set_user_access", { target: userId, has_access: access }));
}

export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return check(await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()) as Profile | null;
}

export async function updateProfile(patch: Partial<Omit<Profile, "id">>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  check(await supabase.from("profiles").update(patch).eq("id", user.id));
}
