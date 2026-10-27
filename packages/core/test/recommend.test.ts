import { describe, expect, it } from "vitest";
import { drinkPhase, recommend } from "../src/recommend.ts";

describe("recommend", () => {
  it("uses style rules first", () => {
    const r = recommend({ name: "Barolo DOCG", grapes: ["Nebbiolo"], color: "red", vintage: 2016 });
    expect(r.profileId).toBe("barolo_barbaresco");
    expect(r.basis).toBe("style");
    expect([r.drinkFrom, r.peakFrom, r.peakTo, r.drinkTo]).toEqual([2022, 2026, 2036, 2046]);
    expect(r.storage.position).toBe("lying");
    expect(r.occasions).toContain("gift");
  });

  it("distinguishes gran reserva from reserva, and only Spanish reserva", () => {
    expect(recommend({ name: "Rioja Gran Reserva", vintage: 2012 }).profileId).toBe("rioja_gran_reserva");
    expect(recommend({ name: "Marqués de Riscal Reserva", region: "Rioja", vintage: 2018 }).profileId).toBe("rioja_reserva");
    expect(recommend({ name: "Casillero del Diablo Reserva", grapes: ["Cabernet Sauvignon"], vintage: 2022 }).profileId).toBe("cabernet_sauvignon");
  });

  it("gives Sancerre a longer window than generic Sauvignon Blanc", () => {
    const r = recommend({ name: "Sancerre", grapes: ["Sauvignon Blanc"], color: "white", vintage: 2019 });
    expect(r.profileId).toBe("sancerre_pouilly");
    expect(r.drinkTo).toBe(2027);
  });

  it("falls back to grape, then color", () => {
    expect(recommend({ name: "Cloudy Bay", grapes: ["Sauvignon Blanc"], color: "white", vintage: 2024 }).basis).toBe("grape");
    const r = recommend({ name: "Okänt rosé", color: "rose", vintage: 2025 });
    expect(r.basis).toBe("color");
    expect(r.storage.position).toBe("standing");
  });

  it("uses color profile for sparkling wine made from a still-wine grape", () => {
    const r = recommend({ name: "Blanc de Blancs", grapes: ["Chardonnay"], color: "sparkling", vintage: 2020 });
    expect(r.profileId).toBe("sparkling_default");
  });

  it("counts non-vintage wines from the reference year", () => {
    const r = recommend({ name: "Champagne Brut", color: "sparkling", vintage: null, referenceYear: 2026 });
    expect(r.drinkFrom).toBe(2026);
  });

  it("prefers food pairings from source data", () => {
    expect(recommend({ name: "Barolo", knownFood: ["pizza"] }).food).toEqual(["pizza"]);
    expect(recommend({ name: "Barolo", knownFood: [] }).food).toContain("game");
  });

  it("computes drink phase", () => {
    const r = recommend({ name: "Barolo", vintage: 2016 });
    expect(drinkPhase(r, 2020)).toBe("too_young");
    expect(drinkPhase(r, 2024)).toBe("ready");
    expect(drinkPhase(r, 2030)).toBe("peak");
    expect(drinkPhase(r, 2040)).toBe("past_peak");
    expect(drinkPhase(r, 2050)).toBe("over");
  });
});
