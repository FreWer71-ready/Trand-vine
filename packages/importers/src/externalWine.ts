// Gemensam form för viner från källor som har streckkoder (Alko,
// Vinmonopolet). Fristående (inga beroenden) så att samma kod används av
// importverktyget och av Supabase-funktionen import-xwines.

export type ExternalColor = "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified";

export interface ExternalWine {
  /** Källans eget produktnummer. */
  ref: string;
  /** Streckkoder som GTIN-13 (samma nyckel som appen använder vid skanning). */
  eans: string[];
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  color: ExternalColor | null;
  grapes: string[];
  abv: number | null;
  vintage: number | null;
  volumeMl: number | null;
}

function validCheckDigit(code: string): boolean {
  const digits = code.split("").map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Som toCanonicalEan i packages/core: GTIN-13 där det går, annars null. */
export function canonicalEan(raw: unknown): string | null {
  const code = String(raw ?? "").replace(/[\s-]/g, "").replace(/\.0$/, "");
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length) || !validCheckDigit(code)) return null;
  if (code.length === 12) return `0${code}`;
  if (code.length === 14 && code.startsWith("0")) return code.slice(1);
  return code;
}

export const text = (v: unknown): string | null => {
  const t = String(v ?? "").replace(/\s+/g, " ").trim();
  return t || null;
};

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function year(v: unknown): number | null {
  const n = num(v);
  return n !== null && Number.isInteger(n) && n >= 1800 && n <= 2200 ? n : null;
}

export function abv(v: unknown): number | null {
  const n = num(v);
  return n !== null && n > 0 && n <= 30 ? n : null;
}

/** "Syrah, Merlot 20 %" → ["Syrah", "Merlot"] */
export function grapeList(v: unknown): string[] {
  return (text(v) ?? "")
    .split(/[,;/]| ja | og /)
    .map((g) => g.replace(/\d+\s*%/g, "").trim())
    .filter((g) => g.length > 1);
}

/** Tar bort årgången i slutet av namnet när den står för sig, t.ex. "Rosso 2021". */
export function stripVintage(name: string, vintage: number | null): string {
  return vintage ? name.replace(new RegExp(`\\s+${vintage}$`), "").trim() || name : name;
}
