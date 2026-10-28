// Etikettläsning: gör om texten som Google Vision läser från en etikett till
// sökord och årgång. Fristående (inga beroenden) så att samma kod används av
// serverfunktionen read-label.

export interface LabelQueries {
  /** Sökord att prova, de troligaste först. */
  queries: string[];
  /** Det som visas i sökrutan, t.ex. "Tommasi Amarone della Valpolicella". */
  display: string;
  vintage: number | null;
}

// Rader som nästan aldrig hör till vinets namn.
const NOISE = [
  /\d+([.,]\d+)?\s*%/,
  /\b\d+([.,]\d+)?\s*(ml|cl|l|ltr|litre|liter)\b/i,
  /\bvol\b/i,
  /sulfit|sulphit|solfiti|sulfite/i,
  /product of|produce of|produit d|prodotto|producto de|erzeugnis|made in/i,
  /bottled|imbottigliat|mis en bouteille|embotellad|abgefüllt|tappat|tapp/i,
  /import|distribu/i,
  /www\.|https?:|@|\.com\b/i,
  /contains|contient|contiene|enthält|innehåller|allergen/i,
  /denominazione|appellation .* contrôlée|controllata|garantita|d\.o\.c|d\.o\.c\.g|a\.o\.c|a\.o\.p/i,
  /\bnr\.?\s*\d|lot\b|\bl\d{3,}/i,
];

const FOUNDED = /since|depuis|dal\b|desde|seit|fondé|founded|est\.|anno/i;

function cleanLine(line: string): string {
  return line.replace(/[|_*•·®™©"“”]/g, " ").replace(/\s+/g, " ").trim();
}

export function labelQueries(text: string): LabelQueries {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);

  let vintage: number | null = null;
  const maxYear = new Date().getFullYear();
  for (const line of lines) {
    if (FOUNDED.test(line)) continue;
    for (const m of line.matchAll(/\b(19[5-9]\d|20[0-9]\d)\b/g)) {
      const y = Number(m[1]);
      if (y <= maxYear) {
        vintage = y;
        break;
      }
    }
    if (vintage) break;
  }

  const good: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\b(19|20)\d\d\b/g, " ").replace(/\s+/g, " ").trim();
    const letters = (line.match(/\p{L}/gu) ?? []).length;
    if (letters < 3 || letters < line.length * 0.6) continue;
    if (NOISE.some((re) => re.test(raw)) || FOUNDED.test(raw)) continue;
    if (!good.some((g) => g.toLowerCase() === line.toLowerCase())) good.push(line);
    if (good.length === 6) break;
  }

  const display = good.slice(0, 2).join(" ");
  const queries = [
    ...(good.length > 2 ? [good.slice(0, 3).join(" ")] : []),
    ...(good.length > 1 ? [display] : []),
    ...good,
  ];
  return { queries: [...new Set(queries)].slice(0, 7), display, vintage };
}
