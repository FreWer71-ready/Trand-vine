import { describe, expect, it } from "vitest";
import { sommelierTips, wineKnowledge } from "../src/knowledge.ts";

describe("wineKnowledge", () => {
  it("matches grapes from data and the region by appellation", () => {
    const k = wineKnowledge({ name: "Barolo Bricco", grapes: ["Nebbiolo"], region: "Piemonte", color: "red" }, "sv");
    expect(k.grapes.map((g) => g.name)).toEqual(["Nebbiolo"]);
    expect(k.grapes[0]!.likely).toBe(false);
    expect(k.region?.name).toBe("Barolo & Barbaresco");
    expect(k.region?.soil).toMatch(/märgel/);
  });

  it("infers a likely grape from the region when grapes are missing", () => {
    const k = wineKnowledge({ name: "Amarone della Valpolicella", region: "Venetien", color: "red" }, "en");
    expect(k.region?.name).toBe("Valpolicella & Amarone");
    expect(k.grapes).toMatchObject([{ name: "Corvina", likely: true }]);
  });

  it("picks a grape of the right colour and handles Swedish region names", () => {
    const k = wineKnowledge({ name: "Sancerre Les Monts", region: "Loiredalen", color: "white" }, "sv");
    expect(k.grapes[0]?.name).toBe("Sauvignon Blanc");
    expect(wineKnowledge({ name: "X", region: "Kalifornien", color: "red" }, "en").region?.name).toBe("California");
  });

  it("keeps Vino Nobile out of the Montepulciano grape and unknown wines empty", () => {
    const k = wineKnowledge({ name: "Vino Nobile di Montepulciano", color: "red" }, "sv");
    expect(k.grapes.map((g) => g.name)).toEqual(["Sangiovese"]);
    expect(k.region?.name).toBe("Toscana");
    expect(wineKnowledge({ name: "Husets rött" }, "sv")).toEqual({ grapes: [], region: null });
  });
});

describe("sommelierTips", () => {
  it("gives glass, temperature, ageing, tasting, food and storage tips", () => {
    const tips = sommelierTips({ color: "red", phase: "too_young", decantMinutes: 60, servingTempC: [16, 18], aromas: ["rosor", "tjära"], bold: true }, "sv");
    expect(tips).toHaveLength(6);
    expect(tips.join(" ")).toMatch(/stort glas.*16–18 °C.*dekantera 60–120 min.*rosor, tjära.*tanniner mjukas.*kylen/s);
  });

  it("adapts to sparkling and mature wines", () => {
    const tips = sommelierTips({ color: "sparkling", phase: "past_peak", decantMinutes: 0, servingTempC: [6, 8] }, "en");
    expect(tips.join(" ")).toMatch(/tulip.*open it soon.*crisps.*sparkling stopper/s);
  });
});
