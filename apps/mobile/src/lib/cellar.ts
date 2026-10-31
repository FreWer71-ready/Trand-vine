// Källarvyn: filtrering, sortering och gruppering av flaskor i lager.

import { COLOR_LABELS, drinkPhase, type DrinkPhase, type Locale, type Recommendation, type WineColor } from "@trand-vine/core";
import type { BottleRow } from "./api.ts";
import { recommendationFor } from "./format.ts";

export interface CellarItem {
  bottle: BottleRow;
  phase: DrinkPhase;
  rec: Recommendation;
}

export type SortKey = "group" | "urgency" | "country" | "region" | "grape" | "added" | "purchased" | "price";
export type SortDir = "asc" | "desc";
/** ready = drickfärdigt (inte för ung), keep = lagras (för ung). */
export type StatusFilter = "all" | "ready" | "keep";

export interface Filters {
  color: WineColor | "all";
  grape: string;
  country: string;
  region: string;
  status: StatusFilter;
}

export const NO_FILTERS: Filters = { color: "all", grape: "all", country: "all", region: "all", status: "all" };

export const SORT_KEYS: SortKey[] = ["group", "urgency", "country", "region", "grape", "added", "purchased", "price"];

/** Riktning när man väljer en sortering: datum och pris börjar med störst/senast. */
export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  group: "asc",
  urgency: "asc",
  country: "asc",
  region: "asc",
  grape: "asc",
  added: "desc",
  purchased: "desc",
  price: "desc",
};

const PHASE_ORDER: Record<DrinkPhase, number> = { over: 0, past_peak: 1, peak: 2, ready: 3, too_young: 4 };
const COLOR_ORDER: WineColor[] = ["red", "white", "rose", "sparkling", "dessert", "fortified"];

export function toItems(bottles: BottleRow[]): CellarItem[] {
  return bottles.map((bottle) => {
    const rec = recommendationFor(bottle);
    return { bottle, rec, phase: drinkPhase(rec) };
  });
}

export const primaryGrape = (b: BottleRow): string | null => b.vintages.wines.grapes[0] ?? null;

export function activeFilterCount(f: Filters): number {
  return (Object.keys(NO_FILTERS) as Array<keyof Filters>).filter((k) => f[k] !== NO_FILTERS[k]).length;
}

export function applyFilters(items: CellarItem[], f: Filters): CellarItem[] {
  return items.filter(({ bottle, phase }) => {
    const w = bottle.vintages.wines;
    if (f.color !== "all" && w.color !== f.color) return false;
    if (f.grape !== "all" && !w.grapes.includes(f.grape)) return false;
    if (f.country !== "all" && w.country !== f.country) return false;
    if (f.region !== "all" && w.region !== f.region) return false;
    if (f.status === "ready" && phase === "too_young") return false;
    if (f.status === "keep" && phase !== "too_young") return false;
    return true;
  });
}

export interface FilterOptions {
  colors: WineColor[];
  grapes: string[];
  countries: string[];
  regions: string[];
}

/** Valmöjligheter hämtade från flaskorna själva, så man bara kan filtrera på det som finns. */
export function filterOptions(items: CellarItem[], locale: Locale): FilterOptions {
  const collator = new Intl.Collator(locale);
  const uniq = (xs: Array<string | null | undefined>) => [...new Set(xs.filter((x): x is string => !!x))].sort(collator.compare);
  const wines = items.map((i) => i.bottle.vintages.wines);
  const colors = COLOR_ORDER.filter((c) => wines.some((w) => w.color === c));
  return {
    colors,
    grapes: uniq(wines.flatMap((w) => w.grapes)),
    countries: uniq(wines.map((w) => w.country)),
    regions: uniq(wines.map((w) => w.region)),
  };
}

export type Row =
  | { kind: "heading"; key: string; title: string; count: number }
  | { kind: "subheading"; key: string; title: string; count: number }
  | { kind: "item"; key: string; item: CellarItem };

export interface Labels {
  locale: Locale;
  unknownType: string;
  unknownGrape: string;
  unknownCountry: string;
  unknownRegion: string;
}

const qty = (xs: CellarItem[]) => xs.reduce((n, i) => n + i.bottle.quantity, 0);
const byUrgency = (a: CellarItem, b: CellarItem) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || a.rec.drinkTo - b.rec.drinkTo;

/** Jämför null/saknade värden sist, oavsett riktning. */
function compareNullable<T>(a: T | null, b: T | null, dir: SortDir, cmp: (x: T, y: T) => number): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === "asc" ? cmp(a, b) : cmp(b, a);
}

function groupBy(items: CellarItem[], keyOf: (i: CellarItem) => string | null): Map<string | null, CellarItem[]> {
  const m = new Map<string | null, CellarItem[]>();
  for (const i of items) {
    const k = keyOf(i);
    m.set(k, [...(m.get(k) ?? []), i]);
  }
  return m;
}

/** Sorterade nycklar, "okänd" (null) sist. */
function orderedKeys(m: Map<string | null, CellarItem[]>, dir: SortDir, locale: Locale, order?: string[]): Array<string | null> {
  const collator = new Intl.Collator(locale);
  const keys = [...m.keys()].filter((k): k is string => k !== null);
  keys.sort(order ? (a, b) => order.indexOf(a) - order.indexOf(b) : (a, b) => (dir === "asc" ? collator.compare(a, b) : collator.compare(b, a)));
  return m.has(null) ? [...keys, null] : keys;
}

function flat(items: CellarItem[]): Row[] {
  return items.map((item) => ({ kind: "item", key: item.bottle.id, item }));
}

/** Gör om filtrerade flaskor till rader: rubriker, underrubriker och flaskor. */
export function buildRows(items: CellarItem[], sort: SortKey, dir: SortDir, labels: Labels): Row[] {
  const { locale } = labels;
  const wine = (i: CellarItem) => i.bottle.vintages.wines;
  const urgent = [...items].sort(byUrgency);

  switch (sort) {
    case "group": {
      // Standard: vintyp, sedan druva. Inom varje druva det som brådskar mest först.
      const rows: Row[] = [];
      const byColor = groupBy(urgent, (i) => wine(i).color);
      for (const color of orderedKeys(byColor, "asc", locale, COLOR_ORDER)) {
        const inColor = byColor.get(color)!;
        rows.push({
          kind: "heading",
          key: `c:${color}`,
          title: color ? COLOR_LABELS[color as WineColor][locale] : labels.unknownType,
          count: qty(inColor),
        });
        const byGrape = groupBy(inColor, (i) => primaryGrape(i.bottle));
        for (const grape of orderedKeys(byGrape, "asc", locale)) {
          const inGrape = byGrape.get(grape)!;
          rows.push({ kind: "subheading", key: `g:${color}:${grape}`, title: grape ?? labels.unknownGrape, count: qty(inGrape) });
          rows.push(...flat(inGrape));
        }
      }
      return rows;
    }
    case "country":
    case "region":
    case "grape": {
      const keyOf =
        sort === "country"
          ? (i: CellarItem) => wine(i).country
          : sort === "region"
            ? (i: CellarItem) => wine(i).region
            : (i: CellarItem) => primaryGrape(i.bottle);
      const unknown = sort === "country" ? labels.unknownCountry : sort === "region" ? labels.unknownRegion : labels.unknownGrape;
      const groups = groupBy(urgent, keyOf);
      return orderedKeys(groups, dir, locale).flatMap((k): Row[] => [
        { kind: "heading", key: `${sort}:${k}`, title: k ?? unknown, count: qty(groups.get(k)!) },
        ...flat(groups.get(k)!),
      ]);
    }
    case "added":
      return flat([...items].sort((a, b) => compareNullable(a.bottle.created_at, b.bottle.created_at, dir, (x, y) => x.localeCompare(y))));
    case "purchased":
      return flat([...items].sort((a, b) => compareNullable(a.bottle.acquired_at, b.bottle.acquired_at, dir, (x, y) => x.localeCompare(y))));
    case "price":
      return flat([...items].sort((a, b) => compareNullable(a.bottle.price, b.bottle.price, dir, (x, y) => x - y)));
    case "urgency":
      return flat(dir === "asc" ? urgent : [...urgent].reverse());
  }
}
