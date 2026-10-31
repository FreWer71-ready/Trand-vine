import { drinkPhase, recommend, type DrinkPhase, type Recommendation } from "@trand-vine/core";
import type { BottleRow, VintageRow } from "./api.ts";

export function wineTitle(v: VintageRow): string {
  const year = v.year ?? "NV";
  return [v.wines.producer, v.wines.name].filter(Boolean).join(" – ") + ` ${year}`;
}

export function recommendationFor(b: BottleRow): Recommendation {
  const w = b.vintages.wines;
  return recommend({
    name: w.name,
    color: w.color,
    grapes: w.grapes,
    region: w.region,
    appellation: w.appellation,
    vintage: b.vintages.year,
    referenceYear: Number((b.acquired_at ?? b.created_at).slice(0, 4)),
    knownFood: w.food_pairings,
  });
}

// Sortering i källaren: det som brådskar mest överst.
const PHASE_ORDER: Record<DrinkPhase, number> = { over: 0, past_peak: 1, peak: 2, ready: 3, too_young: 4 };

export function sortByUrgency(bottles: BottleRow[]): Array<{ bottle: BottleRow; phase: DrinkPhase; rec: Recommendation }> {
  return bottles
    .map((bottle) => {
      const rec = recommendationFor(bottle);
      return { bottle, rec, phase: drinkPhase(rec) };
    })
    .sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || a.rec.drinkTo - b.rec.drinkTo);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Pris med valutasymbol enligt språk, t.ex. "249 kr". Okänd valuta visas som kod. */
export function formatPrice(amount: number, currency: string | null, locale: string): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  try {
    if (currency) {
      return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount);
    }
  } catch {
    // Ogiltig valutakod: faller tillbaka på belopp + kod nedan.
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(amount)}${currency ? ` ${currency}` : ""}`;
}
