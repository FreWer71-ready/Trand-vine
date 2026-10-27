// UPCitemdb – gratisnivå: 100 uppslag/dag utan nyckel.
// https://www.upcitemdb.com/wp/docs/main/development/plan/

import { extractBottleSizeMl, extractVintage, guessColor } from "../parse.ts";
import type { WineCandidate, WineProvider } from "../types.ts";

interface UpcItem {
  ean?: string;
  title?: string;
  brand?: string;
  category?: string;
  size?: string;
  images?: string[];
}

export interface UpcItemDbOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
}

export function upcItemDbProvider(opts: UpcItemDbOptions = {}): WineProvider {
  const doFetch = opts.fetch ?? fetch;
  const baseUrl = opts.baseUrl ?? "https://api.upcitemdb.com/prod/trial";

  return {
    name: "upcitemdb",
    async lookupByBarcode(ean) {
      const res = await doFetch(`${baseUrl}/lookup?upc=${ean}`, {
        headers: { Accept: "application/json" },
      });
      // 429 = dagskvoten slut. Det är inget fel för användaren – vi går vidare.
      if (res.status === 404 || res.status === 429) return [];
      if (!res.ok) throw new Error(`upcitemdb: HTTP ${res.status}`);
      const body = (await res.json()) as { code?: string; items?: UpcItem[] };
      if (body.code !== "OK") return [];
      return (body.items ?? []).flatMap((item) => {
        const c = toCandidate(ean, item);
        return c ? [c] : [];
      });
    },
  };
}

function toCandidate(ean: string, item: UpcItem): WineCandidate | null {
  const title = item.title?.trim();
  if (!title) return null;
  const isWine = /\bwine\b/i.test(item.category ?? "") || /\bwine\b/i.test(title);
  if (!isWine) return null;

  return {
    source: "upcitemdb",
    sourceId: item.ean ?? ean,
    ean,
    name: title,
    producer: item.brand || undefined,
    color: guessColor(`${title} ${item.category ?? ""}`),
    vintage: extractVintage(title),
    bottleSizeMl: extractBottleSizeMl(`${item.size ?? ""} ${title}`),
    imageUrl: item.images?.[0],
  };
}
