import { describe, expect, it } from "vitest";
import { labelQueries } from "../src/label.ts";

describe("labelQueries", () => {
  it("picks name lines and the vintage, skips noise", () => {
    const text = [
      "TOMMASI",
      "dal 1902",
      "AMARONE",
      "DELLA VALPOLICELLA",
      "CLASSICO",
      "DENOMINAZIONE DI ORIGINE CONTROLLATA E GARANTITA",
      "2018",
      "15% vol",
      "750 ml",
      "Imbottigliato da Tommasi Viticoltori - Pedemonte - Italia",
      "CONTIENE SOLFITI",
    ].join("\n");
    const q = labelQueries(text);
    expect(q.vintage).toBe(2018);
    expect(q.display).toBe("TOMMASI AMARONE");
    expect(q.queries[0]).toBe("TOMMASI AMARONE DELLA VALPOLICELLA");
    expect(q.queries).toContain("CLASSICO");
    expect(q.queries.join(" ")).not.toMatch(/vol|ml|SOLFITI|1902|DENOMINAZIONE/);
  });

  it("ignores founding years and future years", () => {
    expect(labelQueries("Château Test\nDepuis 1850\nMargaux").vintage).toBeNull();
    expect(labelQueries("Vino 2099\nRosso").vintage).toBeNull();
    expect(labelQueries("Cava Brut\nNV").queries).toEqual(["Cava Brut"]);
  });

  it("handles empty text", () => {
    expect(labelQueries("")).toEqual({ queries: [], display: "", vintage: null });
  });
});
