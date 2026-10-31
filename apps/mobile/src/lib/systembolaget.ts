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

/**
 * Väljer det Systembolaget-vin bland sökträffarna som bäst motsvarar vinet:
 * alla ord i vinets namn (minst två) ska finnas i träffens namn. Av flera
 * träffar vinner den med minst överskott. Hellre inget svar än fel vin.
 */
export function matchSystembolagetWine<W extends { id: string; name: string; producer: string | null; systembolaget_nr: string | null }>(
  wine: { producer: string | null; name: string },
  candidates: W[],
): W | null {
  const ours = nameTokens(wine.producer, wine.name);
  if (ours.length < 2) return null;
  let best: { w: W; extra: number } | null = null;
  for (const w of candidates) {
    if (!w.systembolaget_nr) continue;
    const theirs = new Set(nameTokens(w.producer, w.name));
    if (!ours.every((t) => theirs.has(t))) continue;
    const extra = theirs.size - ours.length;
    if (!best || extra < best.extra) best = { w, extra };
  }
  return best?.w ?? null;
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
