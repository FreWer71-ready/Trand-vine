import { describe, expect, it, vi } from "vitest";
import { openFoodFactsProvider } from "../src/providers/openFoodFacts.ts";
import { upcItemDbProvider } from "../src/providers/upcItemDb.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("openFoodFactsProvider", () => {
  it("maps a wine product", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      json({
        status: 1,
        product: {
          code: "3263280118114",
          product_name: "Côtes du Rhône Rouge 2021",
          brands: "Guigal, E. Guigal",
          quantity: "75 cl",
          categories_tags: ["en:beverages", "en:wines", "en:red-wines"],
          countries_tags: ["en:france"],
          nutriments: { alcohol: 14 },
          image_front_url: "https://example.com/img.jpg",
        },
      }),
    );
    const [c] = await openFoodFactsProvider({ fetch, userAgent: "Test/1.0" }).lookupByBarcode("3263280118114");
    expect(fetch.mock.calls[0]![0]).toContain("/api/v2/product/3263280118114.json");
    expect(c).toMatchObject({
      source: "openfoodfacts",
      name: "Côtes du Rhône Rouge 2021",
      producer: "Guigal",
      country: "france",
      color: "red",
      abv: 14,
      vintage: 2021,
      bottleSizeMl: 750,
    });
  });

  it("ignores non-wine products and missing products", async () => {
    const notWine = vi.fn(async () =>
      json({ status: 1, product: { product_name: "Cola", categories_tags: ["en:sodas"] } }),
    );
    expect(await openFoodFactsProvider({ fetch: notWine }).lookupByBarcode("1")).toEqual([]);
    const missing = vi.fn(async () => json({ status: 0 }, 404));
    expect(await openFoodFactsProvider({ fetch: missing }).lookupByBarcode("1")).toEqual([]);
  });
});

describe("upcItemDbProvider", () => {
  it("maps wine items and skips others", async () => {
    const fetch = vi.fn(async () =>
      json({
        code: "OK",
        items: [
          { ean: "0089819001234", title: "Kendall-Jackson Chardonnay 2022 750ml", brand: "Kendall-Jackson", category: "Food, Beverages & Tobacco > Beverages > Alcoholic Beverages > Wine" },
          { ean: "0089819001234", title: "Wine opener", category: "Home > Kitchen" },
        ],
      }),
    );
    const res = await upcItemDbProvider({ fetch }).lookupByBarcode("0089819001234");
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ producer: "Kendall-Jackson", vintage: 2022, bottleSizeMl: 750 });
  });

  it("treats quota exhaustion as no result", async () => {
    const fetch = vi.fn(async () => json({ code: "TOO_FAST" }, 429));
    expect(await upcItemDbProvider({ fetch }).lookupByBarcode("1")).toEqual([]);
  });
});
