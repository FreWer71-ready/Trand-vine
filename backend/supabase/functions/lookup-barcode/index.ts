// POST { barcode: string } → LookupResult (+ matchande viner i registret).
//
// Kör uppslaget på servern så att gratiskvoten hos UPCitemdb delas av alla och
// så att Open Food Facts får en korrekt User-Agent.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  lookupBarcode,
  openFoodFactsProvider,
  upcItemDbProvider,
} from "../../../../packages/core/src/index.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const providers = [
  openFoodFactsProvider({ userAgent: "Trand-vine/0.1 (https://github.com/FreWer71-ready/Trand-vine)" }),
  upcItemDbProvider(),
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Användarens JWT – RLS gäller för alla frågor nedan.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { barcode } = await req.json().catch(() => ({}));
  if (typeof barcode !== "string") return json({ error: "barcode_required" }, 400);

  const result = await lookupBarcode(barcode, {
    async findKnownWine(ean) {
      const { data, error } = await supabase
        .from("wine_barcodes").select("wine_id").eq("ean", ean).maybeSingle();
      if (error) throw error;
      return data?.wine_id ?? null;
    },
    providers,
  });

  // Föreslå befintliga viner i registret (LWIN/X-Wines/användare) som matchar
  // källans produktnamn, så att samma vin inte skapas flera gånger.
  if (result.status === "candidates") {
    const first = result.candidates[0]!;
    const q = [first.producer, first.name].filter(Boolean).join(" ");
    const { data: matches } = await supabase.rpc("search_wines", { q, max_results: 5 });
    return json({ ...result, registryMatches: matches ?? [] });
  }
  return json(result);
});
