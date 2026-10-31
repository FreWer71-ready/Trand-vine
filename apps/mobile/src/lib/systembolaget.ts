// Matchning mot Systembolagets sortiment: vilket Systembolaget-vin och vilken
// prisrad som hör till en flaska i källaren. Ren logik, inga anrop.

export interface SbRow {
  wine_id: string;
  short_number: string;
  vintage: number | null;
  volume_ml: number | null;
  price: number | null;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Ord i vinets namn utan årtal och korta ord. */
export function nameTokens(producer: string | null, name: string): string[] {
  return norm([producer, name].filter(Boolean).join(" "))
    .split(" ")
    .filter((t) => t.length > 2 && !/^(19|20)\d{2}$/.test(t));
}

/** Hur väl två ord stämmer: 1 lika, 0,8 nästan lika (prefix eller ett teckens skillnad), annars 0. */
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && long.startsWith(short)) return 0.8;
  if (short.length >= 5 && long.length - short.length <= 1 && editDistance(a, b) <= 1) return 0.8;
  return 0;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

/** Andel av a:s ord som finns (ungefär) i b. */
function coverage(a: string[], b: string[]): number {
  if (!a.length) return 0;
  return a.reduce((sum, t) => sum + Math.max(0, ...b.map((u) => tokenSimilarity(t, u))), 0) / a.length;
}

export interface WineMatch<W> {
  wine: W;
  /** 0–1: hur sannolikt det är att det är samma vin. */
  probability: number;
}

/** Lägsta sannolikhet som visas. */
export const MIN_PROBABILITY = 0.45;

type Matchable = { id: string; name: string; producer: string | null; color?: string | null; systembolaget_nr: string | null };

/**
 * Uppskattar sannolikheten att ett Systembolaget-vin är samma vin som vårt.
 * Vägs ihop av hur många av våra ord som finns i deras namn (viktigast) och hur
 * stor del av deras namn vi täcker. Olika producent, olika typ, ett enda ord
 * eller flera lika bra träffar sänker sannolikheten. Aldrig över 95 %.
 */
export function scoreMatch(wine: Pick<Matchable, "producer" | "name" | "color">, cand: Matchable): number {
  if (!cand.systembolaget_nr) return 0;
  const ours = nameTokens(wine.producer, wine.name);
  const theirs = nameTokens(cand.producer, cand.name);
  if (!ours.length || !theirs.length) return 0;
  const recall = coverage(ours, theirs);
  const precision = coverage(theirs, ours);
  let p = 0.7 * recall + 0.3 * precision;
  if (ours.length < 2) p *= 0.6;
  // Båda har producent men ingen av orden stämmer: troligen ett annat vin.
  const ourProducer = nameTokens(null, wine.producer ?? "");
  const theirProducer = nameTokens(null, cand.producer ?? "");
  if (ourProducer.length && theirProducer.length && coverage(ourProducer, theirProducer) === 0) p *= 0.5;
  if (wine.color && cand.color && wine.color !== cand.color) p *= 0.3;
  return Math.min(0.95, p);
}

/**
 * Det Systembolaget-vin bland träffarna som troligast är samma vin, med
 * sannolikhet avrundad till närmaste 5 %. Ligger två träffar nära varandra
 * sänks sannolikheten. Under MIN_PROBABILITY ges inget svar.
 */
export function matchSystembolagetWine<W extends Matchable>(
  wine: Pick<Matchable, "producer" | "name" | "color">,
  candidates: W[],
): WineMatch<W> | null {
  const scored = candidates.map((w) => ({ w, p: scoreMatch(wine, w) })).sort((a, b) => b.p - a.p);
  const best = scored[0];
  if (!best) return null;
  let p = best.p;
  if (scored[1] && scored[1].p > p - 0.1) p *= 0.85;
  if (p < MIN_PROBABILITY) return null;
  return { wine: best.w, probability: Math.round(p * 20) / 20 };
}

/**
 * Prisraden för en flaska: samma årgång (eller årgångslös rad) och samma storlek
 * (eller okänd storlek). Pris för en annan årgång visas inte.
 */
export function pickOffer(rows: SbRow[], year: number | null, sizeMl: number): SbRow | null {
  const fits = rows.filter(
    (r) =>
      r.price !== null &&
      (year === null ? r.vintage === null : r.vintage === null || r.vintage === year) &&
      (r.volume_ml === null || r.volume_ml === sizeMl),
  );
  // Exakt årgång och storlek går före rader där något är okänt.
  const score = (r: SbRow) => (r.vintage === year ? 2 : 0) + (r.volume_ml === sizeMl ? 1 : 0);
  return fits.sort((a, b) => score(b) - score(a))[0] ?? null;
}
