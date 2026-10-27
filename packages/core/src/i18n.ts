// Texter för nycklar som regelmotorn returnerar.

import type { DrinkPhase, FoodKey, OccasionKey } from "./recommend.ts";
import type { AcquisitionType, WineColor } from "./types.ts";

export type Locale = "sv" | "en";

type Labels<K extends string> = Record<K, Record<Locale, string>>;

export const FOOD_LABELS: Labels<FoodKey> = {
  red_meat: { sv: "Rött kött", en: "Red meat" },
  lamb: { sv: "Lamm", en: "Lamb" },
  game: { sv: "Vilt", en: "Game" },
  beef_stew: { sv: "Grytor", en: "Stews" },
  pork: { sv: "Fläsk", en: "Pork" },
  poultry: { sv: "Kyckling & fågel", en: "Poultry" },
  fish: { sv: "Fisk", en: "Fish" },
  shellfish: { sv: "Skaldjur", en: "Shellfish" },
  salmon: { sv: "Lax", en: "Salmon" },
  sushi: { sv: "Sushi", en: "Sushi" },
  pasta_tomato: { sv: "Pasta med tomatsås", en: "Tomato-based pasta" },
  mushrooms: { sv: "Svamp", en: "Mushrooms" },
  pizza: { sv: "Pizza", en: "Pizza" },
  bbq: { sv: "Grillat", en: "Barbecue" },
  spicy_asian: { sv: "Kryddig asiatisk mat", en: "Spicy Asian food" },
  hard_cheese: { sv: "Hårdost", en: "Hard cheese" },
  soft_cheese: { sv: "Mjukost", en: "Soft cheese" },
  blue_cheese: { sv: "Blåmögelost", en: "Blue cheese" },
  salads: { sv: "Sallader", en: "Salads" },
  vegetarian: { sv: "Vegetariskt", en: "Vegetarian" },
  charcuterie: { sv: "Chark", en: "Charcuterie" },
  dessert_fruit: { sv: "Fruktdesserter", en: "Fruit desserts" },
  chocolate: { sv: "Choklad", en: "Chocolate" },
  aperitif_snacks: { sv: "Tilltugg", en: "Nibbles" },
};

export const OCCASION_LABELS: Labels<OccasionKey> = {
  weekday: { sv: "Vardag", en: "Weekday" },
  dinner_party: { sv: "Middagsbjudning", en: "Dinner party" },
  celebration: { sv: "Fest & firande", en: "Celebration" },
  aperitif: { sv: "Fördrink", en: "Aperitif" },
  summer: { sv: "Sommar & terrass", en: "Summer" },
  bbq_party: { sv: "Grillkväll", en: "BBQ" },
  romantic: { sv: "Romantisk middag", en: "Romantic dinner" },
  special_occasion: { sv: "Speciellt tillfälle", en: "Special occasion" },
  gift: { sv: "Present", en: "Gift" },
  dessert: { sv: "Till efterrätten", en: "With dessert" },
  cozy_evening: { sv: "Mysig kväll", en: "Cozy evening" },
};

export const PHASE_LABELS: Labels<DrinkPhase> = {
  too_young: { sv: "För ung – vänta", en: "Too young – wait" },
  ready: { sv: "Drickfärdig", en: "Ready to drink" },
  peak: { sv: "På topp", en: "At its peak" },
  past_peak: { sv: "Drick snart", en: "Drink soon" },
  over: { sv: "Troligen förbi", en: "Probably past it" },
};

export const ACQUISITION_LABELS: Labels<AcquisitionType> = {
  purchase: { sv: "Köp", en: "Purchase" },
  gift: { sv: "Gåva", en: "Gift" },
  tasting: { sv: "Vinprovning", en: "Tasting" },
  inheritance: { sv: "Arv", en: "Inheritance" },
  trade: { sv: "Byte", en: "Trade" },
  other: { sv: "Annat", en: "Other" },
};

export const COLOR_LABELS: Labels<WineColor> = {
  red: { sv: "Rött", en: "Red" },
  white: { sv: "Vitt", en: "White" },
  rose: { sv: "Rosé", en: "Rosé" },
  sparkling: { sv: "Mousserande", en: "Sparkling" },
  dessert: { sv: "Sött", en: "Dessert" },
  fortified: { sv: "Starkvin", en: "Fortified" },
};
