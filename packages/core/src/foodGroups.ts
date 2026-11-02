// Matgrupper för filtrering i källaren: regelmotorns ~25 maträtter samlade i
// ett fåtal begripliga val (Fisk, Vilt, Ost, Sällskap …). Ett vin hör till en
// grupp om något av dess matförslag finns i gruppen.

import type { Locale } from "./i18n.ts";
import type { FoodKey, OccasionKey, Recommendation } from "./recommend.ts";

export type FoodGroup =
  | "meat" | "lamb" | "game" | "pork" | "poultry" | "fish" | "shellfish"
  | "pasta" | "vegetarian" | "spicy" | "cheese" | "dessert" | "social";

interface GroupDef {
  foods: FoodKey[];
  /** Tillfällen som också räknas, t.ex. fördrink för Sällskap. */
  occasions?: OccasionKey[];
  label: Record<Locale, string>;
}

/** Ordningen här är ordningen i filtret. */
export const FOOD_GROUPS: Record<FoodGroup, GroupDef> = {
  meat: { foods: ["red_meat", "beef_stew", "bbq"], label: { sv: "Kött & grill", en: "Meat & grill" } },
  lamb: { foods: ["lamb"], label: { sv: "Lamm", en: "Lamb" } },
  game: { foods: ["game"], label: { sv: "Vilt", en: "Game" } },
  pork: { foods: ["pork", "charcuterie"], label: { sv: "Fläsk & chark", en: "Pork & charcuterie" } },
  poultry: { foods: ["poultry"], label: { sv: "Fågel", en: "Poultry" } },
  fish: { foods: ["fish", "salmon", "sushi"], label: { sv: "Fisk", en: "Fish" } },
  shellfish: { foods: ["shellfish"], label: { sv: "Skaldjur", en: "Shellfish" } },
  pasta: { foods: ["pasta_tomato", "pizza"], label: { sv: "Pasta & pizza", en: "Pasta & pizza" } },
  vegetarian: { foods: ["vegetarian", "mushrooms", "salads"], label: { sv: "Vegetariskt", en: "Vegetarian" } },
  spicy: { foods: ["spicy_asian"], label: { sv: "Asiatiskt & kryddigt", en: "Asian & spicy" } },
  cheese: { foods: ["hard_cheese", "soft_cheese", "blue_cheese"], label: { sv: "Ost", en: "Cheese" } },
  dessert: { foods: ["dessert_fruit", "chocolate"], label: { sv: "Dessert", en: "Dessert" } },
  social: { foods: ["aperitif_snacks"], occasions: ["aperitif"], label: { sv: "Sällskap & tilltugg", en: "Company & nibbles" } },
};

export const FOOD_GROUP_ORDER = Object.keys(FOOD_GROUPS) as FoodGroup[];

/** Matgrupperna ett vin passar till, utifrån regelmotorns råd. */
export function foodGroupsFor(rec: Pick<Recommendation, "food" | "occasions">): FoodGroup[] {
  return FOOD_GROUP_ORDER.filter((g) => {
    const def = FOOD_GROUPS[g];
    return def.foods.some((f) => rec.food.includes(f)) || (def.occasions ?? []).some((o) => rec.occasions.includes(o));
  });
}
