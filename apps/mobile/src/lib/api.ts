// Dataåtkomst mot Supabase. Alla frågor går under användarens inloggning,
// så RLS i databasen avgör vad som syns.

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

export async function getWine(id: string): Promise<WineRow> {
  return check(await supabase.from("wines").select("*").eq("id", id).single()) as WineRow;
}

export async function searchWines(q: string): Promise<WineRow[]> {
  if (q.trim().length < 2) return [];
  return (check(await supabase.rpc("search_wines", { q, max_results: 20 })) ?? []) as WineRow[];
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

export async function updateBottle(id: string, patch: Partial<Omit<BottleRow, "id" | "vintages">>) {
  check(await supabase.from("bottles").update(patch).eq("id", id));
}

export interface Profile {
  id: string;
  display_name: string;
  locale: "sv" | "en";
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
