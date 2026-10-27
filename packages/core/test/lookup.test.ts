import { describe, expect, it, vi } from "vitest";
import { lookupBarcode } from "../src/lookup.ts";
import type { WineProvider } from "../src/types.ts";

const provider = (name: string, impl: WineProvider["lookupByBarcode"]): WineProvider => ({
  name,
  lookupByBarcode: vi.fn(impl),
});

describe("lookupBarcode", () => {
  it("rejects invalid barcodes", async () => {
    expect(await lookupBarcode("123", { findKnownWine: async () => null, providers: [] })).toEqual({
      status: "invalid_barcode",
    });
  });

  it("returns known wine without calling providers", async () => {
    const p = provider("a", async () => []);
    const res = await lookupBarcode("036000291452", { findKnownWine: async () => "w1", providers: [p] });
    expect(res).toEqual({ status: "known", wineId: "w1", ean: "0036000291452" });
    expect(p.lookupByBarcode).not.toHaveBeenCalled();
  });

  it("stops at first provider with candidates and survives errors", async () => {
    const failing = provider("a", async () => { throw new Error("boom"); });
    const hit = provider("b", async () => [{ source: "b", sourceId: "1", name: "Wine" }]);
    const unused = provider("c", async () => []);
    const res = await lookupBarcode("4006381333931", {
      findKnownWine: async () => null,
      providers: [failing, hit, unused],
    });
    expect(res.status).toBe("candidates");
    expect(unused.lookupByBarcode).not.toHaveBeenCalled();
  });

  it("reports not found with provider errors", async () => {
    const res = await lookupBarcode("4006381333931", {
      findKnownWine: async () => null,
      providers: [provider("a", async () => { throw new Error("down"); })],
    });
    expect(res).toEqual({ status: "not_found", ean: "4006381333931", errors: ["a: down"] });
  });
});
