import { describe, expect, it } from "vitest";
import { extractBottleSizeMl, extractVintage, guessColor } from "../src/parse.ts";

describe("parse", () => {
  it("extracts vintage", () => {
    expect(extractVintage("Rioja Reserva 2018", 2026)).toBe(2018);
    expect(extractVintage("Since 1850 – drink by 2030 – 2019", 2026)).toBe(2019);
    expect(extractVintage("Brut NV", 2026)).toBeUndefined();
  });

  it("extracts bottle size", () => {
    expect(extractBottleSizeMl("75 cl")).toBe(750);
    expect(extractBottleSizeMl("1,5 l")).toBe(1500);
    expect(extractBottleSizeMl("375ml")).toBe(375);
    expect(extractBottleSizeMl("bottle")).toBeUndefined();
  });

  it("guesses color, preferring sparkling over rosé", () => {
    expect(guessColor("Champagne Rosé Brut")).toBe("sparkling");
    expect(guessColor("Côtes de Provence Rosé")).toBe("rose");
    expect(guessColor("Vin Rouge de France")).toBe("red");
    expect(guessColor("Sauvignon Blanc")).toBe("white");
    expect(guessColor("Something")).toBeUndefined();
  });
});
