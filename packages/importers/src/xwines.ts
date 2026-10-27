// Import av X-Wines (CC0): https://github.com/rogerioxavier/X-Wines
//
// Viner importeras med druvor, matkombinationer m.m. Betygen (upp till 21
// miljoner rader) läses strömmande och summeras per vin och årgång till
// startbetyg (seed_avg_rating/seed_rating_count) i vintages.

import { parse } from "csv-parse";
import type { Readable } from "node:stream";
import type { FoodKey, WineColor } from "@trand-vine/core";
import { csvRow, pgArray, type Writer } from "./sql.ts";

const COLORS: Record<string, WineColor> = {
  Red: "red",
  White: "white",
  "Rosé": "rose",
  Sparkling: "sparkling",
  Dessert: "dessert",
  "Dessert/Port": "fortified",
};

const FOODS: Record<string, FoodKey> = {
  Aperitif: "aperitif_snacks",
  Appetizer: "aperitif_snacks",
  Snack: "aperitif_snacks",
  Barbecue: "bbq",
  Grilled: "bbq",
  Beef: "red_meat",
  Veal: "red_meat",
  Lamb: "lamb",
  "Game Meat": "game",
  "Light Stews": "beef_stew",
  Pork: "pork",
  Chicken: "poultry",
  Poultry: "poultry",
  Fish: "fish",
  "Lean Fish": "fish",
  "Rich Fish": "salmon",
  Seafood: "shellfish",
  Shellfish: "shellfish",
  Pasta: "pasta_tomato",
  "Tomato Dishes": "pasta_tomato",
  Pizza: "pizza",
  Mushrooms: "mushrooms",
  Risotto: "mushrooms",
  "Spicy Food": "spicy_asian",
  "Hard Cheese": "hard_cheese",
  "Maturated Cheese": "hard_cheese",
  "Soft Cheese": "soft_cheese",
  "Goat Cheese": "soft_cheese",
  "Blue Cheese": "blue_cheese",
  Salad: "salads",
  Vegetarian: "vegetarian",
  "Cold Cuts": "charcuterie",
  "Cured Meat": "charcuterie",
  Fruit: "dessert_fruit",
  "Fruit Dessert": "dessert_fruit",
  "Sweet Dessert": "dessert_fruit",
  Cake: "dessert_fruit",
  Cream: "dessert_fruit",
  Chocolate: "chocolate",
};

/** X-Wines lagrar listor som Python-literaler: "['Merlot', 'Syrah']". */
export function parsePyList(raw: string): string[] {
  const out: string[] = [];
  const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
  for (const m of raw.matchAll(re)) out.push((m[1] ?? m[2] ?? "").replace(/\\(.)/g, "$1"));
  return out;
}

export interface XWinesWine {
  xwinesId: string;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  color: WineColor | null;
  grapes: string[];
  abv: number | null;
  body: string | null;
  acidity: string | null;
  food: FoodKey[];
}

export function mapWine(row: Record<string, string>): XWinesWine {
  const abv = Number(row.ABV);
  const food = [...new Set(parsePyList(row.Harmonize ?? "").flatMap((h) => FOODS[h] ?? []))];
  return {
    xwinesId: row.WineID!,
    name: row.WineName!.trim(),
    producer: row.WineryName?.trim() || null,
    country: row.Country?.trim() || null,
    region: row.RegionName?.trim() || null,
    color: COLORS[row.Type ?? ""] ?? null,
    grapes: parsePyList(row.Grapes ?? ""),
    abv: Number.isFinite(abv) && abv > 0 && abv <= 30 ? abv : null,
    body: row.Body?.trim() || null,
    acidity: row.Acidity?.trim() || null,
    food,
  };
}

export interface VintageAggregate {
  xwinesId: string;
  year: number | null;
  avg: number;
  count: number;
}

export async function aggregateRatings(input: Readable): Promise<VintageAggregate[]> {
  const sums = new Map<string, { total: number; count: number }>();
  for await (const row of input.pipe(parse({ columns: true })) as AsyncIterable<Record<string, string>>) {
    const score = Number(row.Rating);
    if (!(score >= 1 && score <= 5)) continue;
    const year = /^\d{4}$/.test(row.Vintage ?? "") ? row.Vintage : "NV";
    const key = `${row.WineID}|${year}`;
    const s = sums.get(key) ?? { total: 0, count: 0 };
    s.total += score;
    s.count += 1;
    sums.set(key, s);
  }
  return [...sums].map(([key, s]) => {
    const [xwinesId, year] = key.split("|") as [string, string];
    return {
      xwinesId,
      year: year === "NV" ? null : Number(year),
      avg: Math.round((s.total / s.count) * 100) / 100,
      count: s.count,
    };
  });
}

/**
 * Skriver ett psql-skript som laddar viner och betyg via temporära tabeller
 * och sedan gör upsert. Kan köras om – befintliga rader uppdateras.
 */
export async function writeXWinesSql(
  wines: Readable,
  ratings: Readable | null,
  out: Writer,
): Promise<{ wines: number; vintages: number }> {
  out.write(`\\set ON_ERROR_STOP on
-- Hela X-Wines tar några minuter; Supabase har annars en tidsgräns per sats.
set statement_timeout = 0;
begin;
create temp table xw_wines (
  xwines_id text, name text, producer text, country text, region text,
  color wine_color, grapes text[], abv numeric, body text, acidity text, food_pairings text[]
) on commit drop;
copy xw_wines from stdin with (format csv);
`);
  let wineCount = 0;
  for await (const row of wines.pipe(parse({ columns: true })) as AsyncIterable<Record<string, string>>) {
    const w = mapWine(row);
    if (!w.xwinesId || !w.name) continue;
    out.write(csvRow([
      w.xwinesId, w.name, w.producer, w.country, w.region, w.color,
      pgArray(w.grapes), w.abv, w.body, w.acidity, pgArray(w.food),
    ]));
    wineCount++;
  }
  out.write(`\\.

insert into wines (xwines_id, name, producer, country, region, color, grapes, abv, body, acidity, food_pairings, source)
select xwines_id, name, producer, country, region, color, grapes, abv, body, acidity, food_pairings, 'xwines'
from xw_wines
on conflict (xwines_id) do update set
  name = excluded.name, producer = excluded.producer, country = excluded.country,
  region = excluded.region, color = excluded.color, grapes = excluded.grapes,
  abv = excluded.abv, body = excluded.body, acidity = excluded.acidity,
  food_pairings = excluded.food_pairings;
`);

  let vintageCount = 0;
  if (ratings) {
    const aggregates = await aggregateRatings(ratings);
    out.write(`
create temp table xw_vintages (xwines_id text, year smallint, avg numeric, n int) on commit drop;
copy xw_vintages from stdin with (format csv);
`);
    for (const a of aggregates) out.write(csvRow([a.xwinesId, a.year, a.avg, a.count]));
    vintageCount = aggregates.length;
    out.write(`\\.

insert into vintages (wine_id, year, seed_avg_rating, seed_rating_count)
select w.id, s.year, s.avg, s.n
from xw_vintages s
join wines w on w.xwines_id = s.xwines_id
on conflict (wine_id, coalesce(year, 0)) do update set
  seed_avg_rating = excluded.seed_avg_rating,
  seed_rating_count = excluded.seed_rating_count;

-- Visat medelbetyg = startbetyg + appens användare, i en sats för alla årgångar.
update vintages v set
  rating_count = v.seed_rating_count + agg.n,
  avg_rating = round((v.seed_avg_rating * v.seed_rating_count + agg.total) / (v.seed_rating_count + agg.n), 2)
from (
  select v2.id, count(r.score) as n, coalesce(sum(r.score), 0) as total
  from vintages v2
  join wines w on w.id = v2.wine_id
  left join ratings r on r.vintage_id = v2.id
  where w.source = 'xwines' and v2.seed_rating_count > 0
  group by v2.id
) agg
where v.id = agg.id;
`);
  }
  out.write("commit;\n");
  return { wines: wineCount, vintages: vintageCount };
}
