// Matchning mot Systembolagets sortiment: vilket Systembolaget-vin och vilken
// prisrad som hör till en flaska i källaren, och hur säker prisindikationen är.
// Ren logik, inga anrop.

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

const tokens = (s: string): string[] =>
  norm(s)
    .split(" ")
    .filter((t) => t.length > 2 && !/^(19|20)\d{2}$/.test(t));

/** Vanliga ord som inte skiljer ett vin från ett annat (typ, kvalitetsnivå, småord). */
const GENERIC = new Set(
  "reserva riserva gran grand classico superiore rosso rosato bianco vino wine red white estate estates family les des the and aux sur"
    .split(" "),
);
/** Ord i producentnamn som inte skiljer en producent från en annan. */
const PRODUCER_GENERIC = new Set(
  "domaine chateau tenuta azienda agricola cantina cantine bodega bodegas casa wines winery viticoltori vigneti vineyards family estate estates cave maison weingut"
    .split(" "),
);

/** Ord i vinets namn utan årtal och korta ord. */
export function nameTokens(producer: string | null, name: string): string[] {
  return tokens([producer, name].filter(Boolean).join(" "));
}

/** Ord som skiljer producenter åt (utan "domaine", "tenuta" osv.). */
const producerTokens = (producer: string | null): string[] => tokens(producer ?? "").filter((t) => !PRODUCER_GENERIC.has(t));

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

const overlap = (ours: string[], theirs: string[]) => 0.7 * coverage(ours, theirs) + 0.3 * coverage(theirs, ours);

export interface WineMatch<W> {
  wine: W;
  /** 0–1: hur väl Systembolagets vin motsvarar vårt (före årgång och storlek). */
  score: number;
}

type Matchable = { id: string; name: string; producer: string | null; color?: string | null; systembolaget_nr: string | null };
export type OurWine = Pick<Matchable, "producer" | "name" | "color"> & {
  grapes?: string[];
  region?: string | null;
  appellation?: string | null;
  country?: string | null;
};

/** Namnets ord som verkligen skiljer vinet från andra: inte druva, område eller vanliga ord. */
export function distinctiveTokens(wine: OurWine): string[] {
  const known = new Set([...(wine.grapes ?? []), wine.region, wine.appellation, wine.country].flatMap((x) => tokens(x ?? "")));
  return tokens(wine.name).filter((t) => !GENERIC.has(t) && !known.has(t));
}

/**
 * Hur väl ett Systembolaget-vin motsvarar vårt (0–0,95). Väger ihop hur många av
 * våra ord som finns i deras namn (viktigast) och hur stor del av deras namn vi
 * täcker. Sänks av:
 * - annan producent. Systembolaget anger ibland importören som producent, så
 *   det räcker att ett tydligt produktnamn (t.ex. "150+1") matchar, men då sänks det lite
 * - annan vintyp, ett enda ord i namnet, eller extra namn hos dem som vi saknar
 *   (en annan cuvée, t.ex. "La Gudiola")
 */
export function scoreMatch(wine: OurWine, cand: Matchable): number {
  if (!cand.systembolaget_nr) return 0;
  const ours = nameTokens(wine.producer, wine.name);
  const theirs = nameTokens(cand.producer, cand.name);
  if (!ours.length || !theirs.length) return 0;

  let p = overlap(ours, theirs);
  const ourProducer = producerTokens(wine.producer);
  const sameProducer = !ourProducer.length || coverage(ourProducer, [...producerTokens(cand.producer), ...theirs]) >= 0.5;
  let single = ours.length < 2;
  if (!sameProducer) {
    const distinct = distinctiveTokens(wine);
    const theirName = tokens(cand.name);
    if (distinct.length && coverage(distinct, theirName) >= 0.99) {
      p = overlap(tokens(wine.name), theirName) * 0.8;
      single = tokens(wine.name).length < 2;
    } else {
      p *= 0.5;
    }
  }
  if (single) p *= 0.6;
  // Namn hos dem som vi inte har och som inte är vanliga ord: troligen en annan cuvée.
  const ourAll = new Set(ours);
  const extra = tokens(cand.name).filter((t) => !GENERIC.has(t) && !ourAll.has(t) && !distinctiveTokens(wine).includes(t));
  const known = new Set([...(wine.grapes ?? []), wine.region, wine.appellation, wine.country].flatMap((x) => tokens(x ?? "")));
  const cuvee = extra.filter((t) => !known.has(t) && !producerTokens(cand.producer).includes(t));
  p *= cuvee.length ? 0.75 : 1;
  if (wine.color && cand.color && wine.color !== cand.color) p *= 0.3;
  return Math.min(0.95, p);
}

/** Lägsta poäng för att en kandidat är värd att titta på (årgång och storlek sänker sedan vidare). */
export const MIN_SCORE = 0.4;
/** Lägsta prisindikation som visas. */
export const MIN_INDICATION = 0.45;

/** Kandidater med tillräcklig poäng, bäst först. */
export function rankMatches<W extends Matchable>(wine: OurWine, candidates: W[]): Array<WineMatch<W>> {
  return candidates
    .map((w) => ({ wine: w, score: scoreMatch(wine, w) }))
    .filter((m) => m.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
}

/** Ord att söka på i Systembolagets viner: producentens mest utmärkande ord, annars namnets. */
export function searchTokens(wine: OurWine): string[] {
  const longest = (xs: string[]) => [...xs].sort((a, b) => b.length - a.length)[0];
  return [longest(producerTokens(wine.producer)), longest(distinctiveTokens(wine)), longest(tokens(wine.name))].filter(
    (t, i, all): t is string => !!t && all.indexOf(t) === i,
  );
}

/** Hur mycket en avvikande årgång sänker prisindikationen: 7 % per år, högst 3 år. */
export const VINTAGE_TOLERANCE_YEARS = 3;
const vintageFactor = (diff: number) => 1 - 0.07 * diff;

export interface OfferPick {
  row: SbRow;
  /** 0–1: hur väl årgång och storlek passar flaskan. 1 = exakt. */
  factor: number;
}

/**
 * Prisraden som passar flaskan bäst. Storleken ska stämma (eller vara okänd).
 * Årgången får avvika upp till tre år, med sänkt säkerhet; en årgångslös flaska
 * matchar bara årgångslösa rader.
 */
export function pickOffer(rows: SbRow[], year: number | null, sizeMl: number): OfferPick | null {
  let best: OfferPick | null = null;
  for (const row of rows) {
    if (row.price === null) continue;
    if (row.volume_ml !== null && row.volume_ml !== sizeMl) continue;
    let factor: number;
    if (year === null) {
      if (row.vintage !== null) continue;
      factor = 1;
    } else if (row.vintage === null) {
      factor = 0.95;
    } else {
      const diff = Math.abs(row.vintage - year);
      if (diff > VINTAGE_TOLERANCE_YEARS) continue;
      factor = vintageFactor(diff);
    }
    if (row.volume_ml === null) factor *= 0.95;
    if (!best || factor > best.factor) best = { row, factor };
  }
  return best;
}

/** Nyckel som skiljer olika produkter åt, men inte samma produkt i flera storlekar. */
export const productKey = (producer: string | null, name: string) => norm([producer, name].filter(Boolean).join(" "));

export interface Indication<W> {
  wine: W;
  row: SbRow;
  /** 0–1, avrundad till närmaste 5 %. 1 endast för exakt träff på kopplat vin. */
  probability: number;
}

/**
 * Bästa prisindikationen för en flaska bland kandidaterna: poängen för vinet
 * gånger hur väl årgång och storlek passar. Finns en annan produkt som är nästan
 * lika bra sänks säkerheten.
 */
export function bestIndication<W extends Matchable>(
  matches: Array<WineMatch<W>>,
  rowsOf: (wine: W) => SbRow[],
  year: number | null,
  sizeMl: number,
): Indication<W> | null {
  const options = matches
    .map((m) => {
      const pick = pickOffer(rowsOf(m.wine), year, sizeMl);
      return pick && { wine: m.wine, row: pick.row, p: m.score * pick.factor };
    })
    .filter((o): o is { wine: W; row: SbRow; p: number } => !!o)
    .sort((a, b) => b.p - a.p);
  const best = options[0];
  if (!best) return null;
  let p = best.p;
  const key = productKey(best.wine.producer, best.wine.name);
  const rival = options.find((o) => productKey(o.wine.producer, o.wine.name) !== key);
  if (rival && rival.p > p - 0.1) p *= 0.85;
  if (p < MIN_INDICATION) return null;
  // Kopplat vin med exakt årgång och storlek är ingen gissning.
  const probability = best.wine.systembolaget_nr && best.p >= 1 ? 1 : Math.min(0.95, Math.round(p * 20) / 20);
  return { wine: best.wine, row: best.row, probability };
}
