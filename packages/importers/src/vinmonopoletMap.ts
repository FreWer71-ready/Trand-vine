// Vinmonopolet (Norge): öppet API på api.vinmonopolet.no, kräver en gratis
// prenumerationsnyckel (Ocp-Apim-Subscription-Key). Produkterna har
// streckkoder (GTIN), så flaskor som också säljs i Sverige ger direkt träff.
//
// Fälten läses försiktigt eftersom API:t bara visar det som varuägaren
// delat; saknas något blir det null.

import { abv, canonicalEan, grapeList, num, stripVintage, text, year, type ExternalColor, type ExternalWine } from "./externalWine.ts";

export const VINMONOPOLET_URL = "https://apis.vinmonopolet.no/products/v0/details-normal";

const TYPES: Array<[RegExp, ExternalColor]> = [
  [/musserende|champagne|cava|prosecco|crémant/i, "sparkling"],
  [/sterkvin|portvin|sherry|madeira/i, "fortified"],
  [/dessertvin|søtvin/i, "dessert"],
  [/rosévin|rosevin/i, "rose"],
  [/rødvin/i, "red"],
  [/hvitvin/i, "white"],
];

const COUNTRIES: Record<string, string> = {
  Frankrike: "France", Italia: "Italy", Spania: "Spain", Tyskland: "Germany", Portugal: "Portugal",
  "Østerrike": "Austria", Chile: "Chile", Argentina: "Argentina", Australia: "Australia",
  "New Zealand": "New Zealand", USA: "United States", "Sør-Afrika": "South Africa", Ungarn: "Hungary",
  Hellas: "Greece", Sverige: "Sweden", Norge: "Norway", Georgia: "Georgia", Libanon: "Lebanon",
  Sveits: "Switzerland", Slovenia: "Slovenia", Kroatia: "Croatia", "Romania": "Romania",
  Bulgaria: "Bulgaria", Moldova: "Moldova", Israel: "Israel", Uruguay: "Uruguay", Canada: "Canada",
  Storbritannia: "United Kingdom", England: "United Kingdom", "Nord-Makedonia": "North Macedonia",
  Tyrkia: "Turkey", Kypros: "Cyprus", Tsjekkia: "Czech Republic", Japan: "Japan", Kina: "China",
};

// deno-lint-ignore no-explicit-any
type Json = any;

function gtins(p: Json): string[] {
  const raw = [
    ...(Array.isArray(p?.logistics?.barcodes) ? p.logistics.barcodes : []),
    ...(Array.isArray(p?.barcodes) ? p.barcodes : []),
  ].map((b: Json) => (typeof b === "object" ? (b?.gtin ?? b?.barcode ?? b?.ean) : b));
  return [...new Set(raw.map(canonicalEan).filter((e): e is string => !!e))];
}

export function mapVinmonopolet(p: Json): ExternalWine | null {
  const basic = p?.basic ?? {};
  const ref = text(basic.productId ?? p?.productId);
  const nameRaw = text(basic.productLongName ?? basic.productShortName ?? p?.productShortName);
  const typeText = [
    p?.classification?.mainProductTypeName, p?.classification?.subProductTypeName,
    p?.classification?.productTypeName, p?.mainCategory?.name,
  ].map(text).filter(Boolean).join(" ");
  const color = TYPES.find(([re]) => re.test(typeText))?.[1] ?? null;
  if (!ref || !nameRaw || !color) return null;

  const vintage = year(basic.vintage);
  const country = text(p?.origins?.origin?.country ?? p?.origins?.country);
  const volume = num(basic.volume);
  const grapes = Array.isArray(p?.ingredients?.grapes)
    ? p.ingredients.grapes.map((g: Json) => text(g?.grapeDesc ?? g?.name ?? g)).filter(Boolean)
    : grapeList(p?.ingredients?.ingredients);

  return {
    ref,
    eans: gtins(p),
    name: stripVintage(nameRaw, vintage),
    producer: text(p?.logistics?.manufacturerName ?? p?.producer?.name),
    country: country ? (COUNTRIES[country] ?? country) : null,
    region: text(p?.origins?.origin?.region ?? p?.origins?.region),
    color,
    grapes,
    abv: abv(basic.alcoholContent),
    vintage,
    // Volym anges i liter (0.75) eller centiliter (75).
    volumeMl: volume === null || volume <= 0 ? null : Math.round(volume <= 10 ? volume * 1000 : volume * 10),
  };
}

export function mapVinmonopoletAll(products: Json[]): ExternalWine[] {
  const out = new Map<string, ExternalWine>();
  for (const p of products) {
    const w = mapVinmonopolet(p);
    if (w) out.set(w.ref, w);
  }
  return [...out.values()];
}
