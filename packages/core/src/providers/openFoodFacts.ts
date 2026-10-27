// Open Food Facts – gratis, öppen produktdatabas (ODbL).
// API-dokumentation: https://openfoodfacts.github.io/openfoodfacts-server/api/

import { extractBottleSizeMl, extractVintage, guessColor } from "../parse.ts";
import type { WineCandidate, WineColor, WineProvider } from "../types.ts";

const FIELDS = [
  "code",
  "product_name",
  "generic_name",
  "brands",
  "quantity",
  "categories_tags",
  "countries_tags",
  "origins",
  "image_front_url",
  "nutriments",
].join(",");

const CATEGORY_COLORS: Array<[string, WineColor]> = [
  ["en:sparkling-wines", "sparkling"],
  ["en:champagnes", "sparkling"],
  ["en:fortified-wines", "fortified"],
  ["en:dessert-wines", "dessert"],
  ["en:rose-wines", "rose"],
  ["en:white-wines", "white"],
  ["en:red-wines", "red"],
];

interface OffProduct {
  code?: string;
  product_name?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  categories_tags?: string[];
  countries_tags?: string[];
  origins?: string;
  image_front_url?: string;
  nutriments?: { alcohol?: number; alcohol_100g?: number };
}

export interface OpenFoodFactsOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
  /** OFF ber om en identifierande User-Agent: "App/version (kontakt)". */
  userAgent?: string;
}

export function openFoodFactsProvider(
  opts: OpenFoodFactsOptions = {},
): WineProvider {
  const doFetch = opts.fetch ?? fetch;
  const baseUrl = opts.baseUrl ?? "https://world.openfoodfacts.org";

  return {
    name: "openfoodfacts",
    async lookupByBarcode(ean) {
      const url = `${baseUrl}/api/v2/product/${ean}.json?fields=${FIELDS}`;
      const headers: Record<string, string> = {};
      if (opts.userAgent) headers["User-Agent"] = opts.userAgent;
      const res = await doFetch(url, { headers });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`openfoodfacts: HTTP ${res.status}`);
      const body = (await res.json()) as { status?: number; product?: OffProduct };
      if (body.status !== 1 || !body.product) return [];
      const candidate = toCandidate(ean, body.product);
      return candidate ? [candidate] : [];
    },
  };
}

function toCandidate(ean: string, p: OffProduct): WineCandidate | null {
  const categories = p.categories_tags ?? [];
  const isWine = categories.some((c) => c === "en:wines" || c.endsWith("-wines"));
  const name = (p.product_name || p.generic_name || "").trim();
  if (!isWine || !name) return null;

  const text = `${name} ${p.generic_name ?? ""}`;
  const color =
    CATEGORY_COLORS.find(([tag]) => categories.includes(tag))?.[1] ??
    guessColor(text);
  const abv = p.nutriments?.alcohol ?? p.nutriments?.alcohol_100g;
  const country = p.countries_tags?.[0]?.replace(/^en:/, "");

  return {
    source: "openfoodfacts",
    sourceId: p.code ?? ean,
    ean,
    name,
    producer: p.brands?.split(",")[0]?.trim() || undefined,
    country: p.origins?.split(",")[0]?.trim() || country,
    color,
    abv: typeof abv === "number" && abv > 0 ? abv : undefined,
    vintage: extractVintage(text),
    bottleSizeMl: p.quantity ? extractBottleSizeMl(p.quantity) : undefined,
    imageUrl: p.image_front_url,
  };
}
