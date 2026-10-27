// Identifiering av vin från streckkod: egen databas först, sedan externa
// källor i tur och ordning. Första källan som ger träff vinner, så att
// begränsade gratiskvoter (UPCitemdb) bara används när det behövs.

import { toCanonicalEan } from "./barcode.ts";
import type { WineCandidate, WineProvider } from "./types.ts";

export type LookupResult =
  | { status: "invalid_barcode" }
  | { status: "known"; wineId: string; ean: string }
  | { status: "candidates"; ean: string; candidates: WineCandidate[] }
  | { status: "not_found"; ean: string; errors: string[] };

export interface LookupDeps {
  /** Slår upp en bekräftad koppling EAN → vin i egen databas. */
  findKnownWine(ean: string): Promise<string | null>;
  providers: WineProvider[];
}

export async function lookupBarcode(
  raw: string,
  deps: LookupDeps,
): Promise<LookupResult> {
  const ean = toCanonicalEan(raw);
  if (!ean) return { status: "invalid_barcode" };

  const wineId = await deps.findKnownWine(ean);
  if (wineId) return { status: "known", wineId, ean };

  const errors: string[] = [];
  for (const provider of deps.providers) {
    try {
      const candidates = await provider.lookupByBarcode(ean);
      if (candidates.length > 0) return { status: "candidates", ean, candidates };
    } catch (err) {
      errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { status: "not_found", ean, errors };
}
