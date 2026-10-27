// Streckkodshjälp: normalisering och kontrollsiffra för EAN-8, UPC-A (12),
// EAN-13 och GTIN-14.

const VALID_LENGTHS = new Set([8, 12, 13, 14]);

/** Tar bort mellanslag/bindestreck. Returnerar null om det inte är siffror. */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits) || !VALID_LENGTHS.has(digits.length)) return null;
  return digits;
}

export function hasValidCheckDigit(code: string): boolean {
  const digits = code.split("").map(Number);
  const check = digits.pop();
  // Vikterna 3,1,3,1… räknas från höger (siffran närmast kontrollsiffran får 3).
  const sum = digits
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Normaliserar till GTIN-13 där det går, så att UPC-A "012345678905" och
 * EAN-13 "0012345678905" lagras som samma nyckel.
 */
export function toCanonicalEan(raw: string): string | null {
  const code = normalizeBarcode(raw);
  if (!code || !hasValidCheckDigit(code)) return null;
  if (code.length === 12) return `0${code}`;
  if (code.length === 14 && code.startsWith("0")) return code.slice(1);
  return code;
}
