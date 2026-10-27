// Tolkning av fritext från produktnamn och etiketter: årgång, storlek, färg.

import type { WineColor } from "./types.ts";

/** Hittar en rimlig årgång (1900–i år) i en text, t.ex. "Rioja Reserva 2018". */
export function extractVintage(
  text: string,
  currentYear = new Date().getFullYear(),
): number | undefined {
  const matches = text.match(/\b(19|20)\d{2}\b/g) ?? [];
  const years = matches
    .map(Number)
    .filter((y) => y >= 1900 && y <= currentYear);
  return years[0];
}

/** "75 cl", "750ml", "1,5 l", "1.5L" → ml. */
export function extractBottleSizeMl(text: string): number | undefined {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/i);
  if (!m) return undefined;
  const value = Number(m[1]!.replace(",", "."));
  const unit = m[2]!.toLowerCase();
  const ml = unit === "ml" ? value : unit === "cl" ? value * 10 : value * 1000;
  return Math.round(ml);
}

// \b fungerar inte för ord som slutar på "é" – använd Unicode-bokstavsgränser.
const words = (alternatives: string) =>
  new RegExp(`(?<!\\p{L})(${alternatives})(?!\\p{L})`, "iu");

const COLOR_KEYWORDS: Array<[WineColor, RegExp]> = [
  [
    "sparkling",
    words("sparkling|mousserande|champagne|cava|prosecco|crémant|cremant|sekt|spumante|schaumwein|vin mousseux|espumoso"),
  ],
  [
    "fortified",
    words("port|porto|portvin|sherry|madeira|marsala|fortified|starkvin|vin doux naturel"),
  ],
  [
    "dessert",
    words("dessert wine|dessertvin|sauternes|tokaji|ice ?wine|eiswein|late harvest|sweet wine|sött vin|vin liquoreux"),
  ],
  ["rose", words("ros[ée]|rosado|rosato|rosévin|blush")],
  ["white", words("white|vitt|blanc|bianco|blanco|weisswein|weißwein|branco|vin blanc|vitt vin")],
  ["red", words("red|rött|rouge|rosso|tinto|rotwein|vin rouge|rött vin")],
];

export function guessColor(text: string): WineColor | undefined {
  return COLOR_KEYWORDS.find(([, re]) => re.test(text))?.[0];
}
