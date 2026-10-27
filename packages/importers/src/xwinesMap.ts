// Översättning av X-Wines-rader till Trand-vines vinmodell. Helt fristående
// (inga beroenden) så att samma kod används av importverktyget och av
// Supabase-funktionen import-xwines.
//
// Typerna motsvarar WineColor och FoodKey i packages/core.

export type XWinesColor = "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified";

const COLORS: Record<string, XWinesColor> = {
  Red: "red",
  White: "white",
  "Rosé": "rose",
  Sparkling: "sparkling",
  Dessert: "dessert",
  "Dessert/Port": "fortified",
};

const FOODS: Record<string, string> = {
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
  color: XWinesColor | null;
  grapes: string[];
  abv: number | null;
  body: string | null;
  acidity: string | null;
  food: string[];
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

