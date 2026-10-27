import { describe, expect, it } from "vitest";
import { hasValidCheckDigit, normalizeBarcode, toCanonicalEan } from "../src/barcode.ts";

describe("barcode", () => {
  it("normalizes spaces and dashes", () => {
    expect(normalizeBarcode("7 312040-017034")).toBe("7312040017034");
    expect(normalizeBarcode("abc")).toBeNull();
    expect(normalizeBarcode("12345")).toBeNull();
  });

  it("validates check digits", () => {
    expect(hasValidCheckDigit("4006381333931")).toBe(true); // EAN-13
    expect(hasValidCheckDigit("4006381333932")).toBe(false);
    expect(hasValidCheckDigit("036000291452")).toBe(true); // UPC-A
    expect(hasValidCheckDigit("96385074")).toBe(true); // EAN-8
  });

  it("canonicalizes UPC-A and GTIN-14 to EAN-13", () => {
    expect(toCanonicalEan("036000291452")).toBe("0036000291452");
    expect(toCanonicalEan("00036000291452")).toBe("0036000291452");
    expect(toCanonicalEan("4006381333931")).toBe("4006381333931");
    expect(toCanonicalEan("4006381333932")).toBeNull();
  });
});
