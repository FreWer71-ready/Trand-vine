// Regelmotor för råd: drickfönster, lagring, servering, mat och tillfälle.
//
// Matchning sker i prioritetsordning: region/appellation/stil (t.ex. "Barolo",
// "Rioja Gran Reserva") → druva → färg. Åldersintervall anges i år från
// årgången. Reglerna är medvetet grova tumregler – appen visar dem som råd.

import type { WineColor } from "./types.ts";

export type FoodKey =
  | "red_meat" | "lamb" | "game" | "beef_stew" | "pork" | "poultry"
  | "fish" | "shellfish" | "salmon" | "sushi" | "pasta_tomato"
  | "mushrooms" | "pizza" | "bbq" | "spicy_asian" | "hard_cheese"
  | "soft_cheese" | "blue_cheese" | "salads" | "vegetarian" | "charcuterie"
  | "dessert_fruit" | "chocolate" | "aperitif_snacks";

export type OccasionKey =
  | "weekday" | "dinner_party" | "celebration" | "aperitif" | "summer"
  | "bbq_party" | "romantic" | "special_occasion" | "gift" | "dessert"
  | "cozy_evening";

interface Profile {
  id: string;
  /** [klar att dricka, toppen börjar, toppen slutar, drick senast] i år efter årgång */
  ageing: [number, number, number, number];
  servingC: [number, number];
  decantMinutes: number;
  food: FoodKey[];
  occasions: OccasionKey[];
}

interface Rule extends Profile {
  match: RegExp;
}

// Region/stil – mest specifika först.
const STYLE_RULES: Rule[] = [
  { id: "vintage_port", match: /\bvintage port\b/i, ageing: [10, 20, 40, 60], servingC: [16, 18], decantMinutes: 60, food: ["blue_cheese", "chocolate"], occasions: ["special_occasion", "gift", "cozy_evening"] },
  { id: "tawny_port", match: /\b(tawny|ruby|lbv|late bottled)\b/i, ageing: [0, 0, 5, 10], servingC: [14, 16], decantMinutes: 0, food: ["blue_cheese", "chocolate", "dessert_fruit"], occasions: ["cozy_evening", "dessert"] },
  { id: "champagne", match: /\bchampagne\b/i, ageing: [0, 1, 6, 10], servingC: [7, 10], decantMinutes: 0, food: ["shellfish", "aperitif_snacks", "fish", "poultry"], occasions: ["celebration", "aperitif", "romantic", "gift"] },
  { id: "prosecco_cava", match: /\b(prosecco|cava|crémant|cremant|spumante)\b/i, ageing: [0, 0, 2, 3], servingC: [6, 8], decantMinutes: 0, food: ["aperitif_snacks", "charcuterie", "salads"], occasions: ["aperitif", "celebration", "summer"] },
  { id: "sauternes_tokaji", match: /\b(sauternes|barsac|tokaji|aszú|aszu)\b/i, ageing: [3, 8, 25, 40], servingC: [8, 11], decantMinutes: 0, food: ["blue_cheese", "dessert_fruit"], occasions: ["dessert", "special_occasion", "gift"] },
  { id: "barolo_barbaresco", match: /\b(barolo|barbaresco)\b/i, ageing: [6, 10, 20, 30], servingC: [16, 18], decantMinutes: 90, food: ["red_meat", "game", "mushrooms", "hard_cheese"], occasions: ["special_occasion", "dinner_party", "gift"] },
  { id: "brunello", match: /\bbrunello\b/i, ageing: [5, 8, 18, 25], servingC: [16, 18], decantMinutes: 60, food: ["red_meat", "game", "beef_stew", "hard_cheese"], occasions: ["special_occasion", "dinner_party", "gift"] },
  { id: "amarone", match: /\bamarone\b/i, ageing: [4, 7, 15, 20], servingC: [16, 18], decantMinutes: 60, food: ["beef_stew", "game", "hard_cheese"], occasions: ["cozy_evening", "special_occasion", "gift"] },
  { id: "rioja_gran_reserva", match: /\bgran reserva\b/i, ageing: [5, 8, 20, 30], servingC: [16, 18], decantMinutes: 45, food: ["lamb", "red_meat", "hard_cheese"], occasions: ["dinner_party", "special_occasion", "gift"] },
  { id: "rioja_reserva", match: /\b(rioja|ribera del duero)\b.*\breserva\b|\breserva\b.*\b(rioja|ribera del duero)\b/i, ageing: [3, 5, 12, 18], servingC: [16, 18], decantMinutes: 30, food: ["lamb", "red_meat", "charcuterie"], occasions: ["dinner_party", "cozy_evening"] },
  { id: "chianti", match: /\bchianti\b/i, ageing: [1, 3, 8, 12], servingC: [15, 17], decantMinutes: 30, food: ["pasta_tomato", "pizza", "red_meat", "charcuterie"], occasions: ["weekday", "dinner_party"] },
  { id: "bordeaux_left", match: /\b(pauillac|margaux|saint-julien|st-julien|saint-estèphe|pessac|médoc|medoc)\b/i, ageing: [5, 10, 20, 30], servingC: [16, 18], decantMinutes: 60, food: ["lamb", "red_meat", "game"], occasions: ["special_occasion", "dinner_party", "gift"] },
  { id: "bordeaux", match: /\b(bordeaux|saint-émilion|saint-emilion|pomerol)\b/i, ageing: [3, 6, 12, 20], servingC: [16, 18], decantMinutes: 45, food: ["lamb", "red_meat", "mushrooms"], occasions: ["dinner_party", "gift"] },
  { id: "red_burgundy", match: /\b(bourgogne rouge|gevrey|chambolle|vosne|nuits-saint-georges|pommard|volnay)\b/i, ageing: [3, 6, 15, 20], servingC: [14, 16], decantMinutes: 20, food: ["poultry", "mushrooms", "game", "salmon"], occasions: ["romantic", "dinner_party", "gift"] },
  { id: "white_burgundy", match: /\b(chablis|meursault|puligny|chassagne|bourgogne blanc)\b/i, ageing: [1, 3, 8, 12], servingC: [10, 13], decantMinutes: 0, food: ["fish", "shellfish", "poultry"], occasions: ["dinner_party", "romantic"] },
  { id: "riesling_sweet", match: /\b(spätlese|spatlese|auslese|beerenauslese)\b/i, ageing: [2, 5, 20, 30], servingC: [8, 10], decantMinutes: 0, food: ["spicy_asian", "dessert_fruit", "blue_cheese"], occasions: ["dessert", "gift"] },
  { id: "sancerre_pouilly", match: /\b(sancerre|pouilly-fum[ée])/i, ageing: [0, 1, 5, 8], servingC: [9, 11], decantMinutes: 0, food: ["shellfish", "soft_cheese", "fish", "salads"], occasions: ["dinner_party", "summer", "aperitif"] },
  { id: "beaujolais", match: /\b(beaujolais|morgon|fleurie|moulin-à-vent)\b/i, ageing: [0, 1, 4, 6], servingC: [12, 14], decantMinutes: 0, food: ["charcuterie", "poultry", "pork"], occasions: ["weekday", "summer", "bbq_party"] },
];

// Druvor – när ingen regional regel matchar.
const GRAPE_RULES: Rule[] = [
  { id: "nebbiolo", match: /nebbiolo/i, ageing: [4, 7, 15, 25], servingC: [16, 18], decantMinutes: 60, food: ["red_meat", "game", "mushrooms"], occasions: ["dinner_party", "special_occasion"] },
  { id: "cabernet_sauvignon", match: /cabernet sauvignon/i, ageing: [2, 5, 12, 20], servingC: [16, 18], decantMinutes: 45, food: ["red_meat", "lamb", "bbq", "hard_cheese"], occasions: ["dinner_party", "cozy_evening"] },
  { id: "syrah", match: /\b(syrah|shiraz)\b/i, ageing: [1, 3, 10, 15], servingC: [16, 18], decantMinutes: 30, food: ["bbq", "game", "lamb", "beef_stew"], occasions: ["bbq_party", "cozy_evening"] },
  { id: "merlot", match: /merlot/i, ageing: [1, 3, 8, 12], servingC: [15, 17], decantMinutes: 30, food: ["red_meat", "pork", "mushrooms", "pasta_tomato"], occasions: ["weekday", "dinner_party"] },
  { id: "sangiovese", match: /sangiovese/i, ageing: [1, 3, 8, 12], servingC: [15, 17], decantMinutes: 30, food: ["pasta_tomato", "pizza", "red_meat"], occasions: ["weekday", "dinner_party"] },
  { id: "tempranillo", match: /tempranillo/i, ageing: [1, 3, 8, 12], servingC: [15, 17], decantMinutes: 30, food: ["lamb", "charcuterie", "red_meat"], occasions: ["weekday", "dinner_party"] },
  { id: "pinot_noir", match: /pinot noir|spätburgunder/i, ageing: [1, 2, 7, 10], servingC: [13, 16], decantMinutes: 15, food: ["poultry", "salmon", "mushrooms", "pork"], occasions: ["romantic", "dinner_party"] },
  { id: "malbec", match: /malbec/i, ageing: [1, 2, 7, 10], servingC: [16, 18], decantMinutes: 30, food: ["red_meat", "bbq"], occasions: ["bbq_party", "cozy_evening"] },
  { id: "zinfandel_primitivo", match: /zinfandel|primitivo/i, ageing: [0, 1, 5, 8], servingC: [15, 17], decantMinutes: 15, food: ["bbq", "pizza", "red_meat"], occasions: ["bbq_party", "weekday"] },
  { id: "grenache", match: /grenache|garnacha/i, ageing: [1, 2, 7, 10], servingC: [15, 17], decantMinutes: 20, food: ["lamb", "bbq", "vegetarian"], occasions: ["weekday", "bbq_party"] },
  { id: "riesling", match: /riesling/i, ageing: [0, 2, 10, 15], servingC: [8, 10], decantMinutes: 0, food: ["spicy_asian", "fish", "shellfish", "pork"], occasions: ["weekday", "dinner_party", "summer"] },
  { id: "chardonnay", match: /chardonnay/i, ageing: [0, 1, 5, 8], servingC: [10, 13], decantMinutes: 0, food: ["fish", "poultry", "shellfish", "soft_cheese"], occasions: ["dinner_party", "weekday"] },
  { id: "chenin_blanc", match: /chenin/i, ageing: [0, 2, 8, 15], servingC: [9, 11], decantMinutes: 0, food: ["fish", "poultry", "pork", "spicy_asian"], occasions: ["weekday", "dinner_party"] },
  { id: "sauvignon_blanc", match: /sauvignon blanc/i, ageing: [0, 0, 3, 5], servingC: [7, 10], decantMinutes: 0, food: ["shellfish", "salads", "fish", "soft_cheese"], occasions: ["summer", "aperitif", "weekday"] },
  { id: "pinot_grigio", match: /pinot gri[gs]/i, ageing: [0, 0, 2, 3], servingC: [7, 10], decantMinutes: 0, food: ["fish", "salads", "aperitif_snacks"], occasions: ["summer", "weekday", "aperitif"] },
  { id: "gewurztraminer", match: /gew[uü]rztraminer/i, ageing: [0, 1, 5, 8], servingC: [8, 10], decantMinutes: 0, food: ["spicy_asian", "soft_cheese"], occasions: ["dinner_party"] },
];

const COLOR_DEFAULTS: Record<WineColor, Profile> = {
  red: { id: "red_default", ageing: [0, 1, 4, 6], servingC: [15, 17], decantMinutes: 15, food: ["red_meat", "pasta_tomato", "hard_cheese"], occasions: ["weekday", "dinner_party"] },
  white: { id: "white_default", ageing: [0, 1, 3, 5], servingC: [8, 11], decantMinutes: 0, food: ["fish", "poultry", "salads"], occasions: ["weekday", "summer"] },
  rose: { id: "rose_default", ageing: [0, 0, 1, 2], servingC: [7, 10], decantMinutes: 0, food: ["salads", "shellfish", "charcuterie"], occasions: ["summer", "aperitif", "bbq_party"] },
  sparkling: { id: "sparkling_default", ageing: [0, 0, 2, 3], servingC: [6, 9], decantMinutes: 0, food: ["aperitif_snacks", "shellfish"], occasions: ["celebration", "aperitif"] },
  dessert: { id: "dessert_default", ageing: [0, 2, 10, 20], servingC: [8, 11], decantMinutes: 0, food: ["dessert_fruit", "blue_cheese"], occasions: ["dessert"] },
  fortified: { id: "fortified_default", ageing: [0, 0, 5, 15], servingC: [14, 17], decantMinutes: 0, food: ["blue_cheese", "chocolate"], occasions: ["cozy_evening", "dessert"] },
};

export interface RecommendInput {
  name: string;
  color?: WineColor | null;
  grapes?: string[];
  region?: string | null;
  appellation?: string | null;
  /** null/undefined = icke-årgångsvin; räknas från inköpsåret. */
  vintage?: number | null;
  /** År som NV-viner räknas från (t.ex. inköpsår). Standard: i år. */
  referenceYear?: number;
  /** Matkombinationer från källdata (t.ex. X-Wines) – går före regelmotorns. */
  knownFood?: FoodKey[];
}

export interface Recommendation {
  profileId: string;
  basis: "style" | "grape" | "color" | "fallback";
  drinkFrom: number;
  peakFrom: number;
  peakTo: number;
  drinkTo: number;
  storage: {
    tempC: [number, number];
    position: "lying" | "standing";
    potentialYears: number;
  };
  servingTempC: [number, number];
  decantMinutes: number;
  food: FoodKey[];
  occasions: OccasionKey[];
}

export type DrinkPhase = "too_young" | "ready" | "peak" | "past_peak" | "over";

export function recommend(input: RecommendInput): Recommendation {
  const text = [input.name, input.region, input.appellation].filter(Boolean).join(" ");
  const grapes = (input.grapes ?? []).join(" ");

  let basis: Recommendation["basis"];
  let profile: Profile | undefined = STYLE_RULES.find((r) => r.match.test(text));
  if (profile) basis = "style";
  else if ((profile = GRAPE_RULES.find((r) => r.match.test(grapes) || r.match.test(text)))) basis = "grape";
  else if (input.color) {
    profile = COLOR_DEFAULTS[input.color];
    basis = "color";
  } else {
    profile = COLOR_DEFAULTS.red;
    basis = "fallback";
  }

  // Druvregler gäller för stilla viner. Ett mousserande eller sött vin av t.ex.
  // chardonnay ska följa färgens profil.
  if (basis === "grape" && input.color && ["sparkling", "dessert", "fortified"].includes(input.color)) {
    profile = COLOR_DEFAULTS[input.color];
    basis = "color";
  }

  const base = input.vintage ?? input.referenceYear ?? new Date().getFullYear();
  const [ready, peakStart, peakEnd, drinkBy] = profile.ageing;
  const potentialYears = drinkBy;

  const occasions = new Set(profile.occasions);
  if (potentialYears >= 15) occasions.add("gift");

  return {
    profileId: profile.id,
    basis,
    drinkFrom: base + ready,
    peakFrom: base + peakStart,
    peakTo: base + peakEnd,
    drinkTo: base + drinkBy,
    storage: {
      tempC: [10, 14],
      // Korkade viner som ska lagras länge ligger ner så korken inte torkar.
      position: potentialYears >= 3 ? "lying" : "standing",
      potentialYears,
    },
    servingTempC: profile.servingC,
    decantMinutes: profile.decantMinutes,
    food: input.knownFood?.length ? input.knownFood : profile.food,
    occasions: [...occasions],
  };
}

export function drinkPhase(rec: Recommendation, year = new Date().getFullYear()): DrinkPhase {
  if (year < rec.drinkFrom) return "too_young";
  if (year < rec.peakFrom) return "ready";
  if (year <= rec.peakTo) return "peak";
  if (year <= rec.drinkTo) return "past_peak";
  return "over";
}
