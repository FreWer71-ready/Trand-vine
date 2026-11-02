import { describe, expect, it } from "vitest";
import { FOOD_GROUPS, foodGroupsFor } from "../src/foodGroups.ts";
import { FOOD_LABELS } from "../src/i18n.ts";
import { recommend } from "../src/recommend.ts";

describe("foodGroupsFor", () => {
  it("groups a wine's food suggestions", () => {
    expect(foodGroupsFor({ food: ["salmon", "hard_cheese"], occasions: [] })).toEqual(["fish", "cheese"]);
    expect(foodGroupsFor({ food: [], occasions: ["aperitif"] })).toEqual(["social"]);
    expect(foodGroupsFor({ food: ["aperitif_snacks", "game"], occasions: [] })).toEqual(["game", "social"]);
  });

  it("covers every food the rule engine can suggest", () => {
    const grouped = new Set(Object.values(FOOD_GROUPS).flatMap((g) => g.foods));
    for (const food of Object.keys(FOOD_LABELS)) expect(grouped.has(food as never), food).toBe(true);
  });

  it("works on real recommendations", () => {
    expect(foodGroupsFor(recommend({ name: "Barolo", color: "red", vintage: 2016 }))).toEqual(expect.arrayContaining(["meat", "game"]));
    expect(foodGroupsFor(recommend({ name: "Chablis", color: "white", vintage: 2022 }))).toContain("fish");
  });
});
