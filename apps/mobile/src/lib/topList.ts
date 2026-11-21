// Topplista över druckna viner. Flaskor av samma vin och årgång slås ihop.
// Viner med betyg rankas efter snittbetyg, sedan efter hur ofta de druckits.
// Viner utan betyg kommer efter, sorterade efter antal och senast druckna.

import type { BottleRow } from "./api.ts";

export interface TopEntry {
  vintage: BottleRow["vintages"];
  /** Antal druckna flaskor. */
  count: number;
  /** Snitt av egna betyg, null om ingen flaska har betyg. */
  rating: number | null;
  ratedCount: number;
  lastDrunk: string | null;
  /** Senast druckna flaskan, för att öppna och sätta betyg. */
  latestBottleId: string;
}

export function topList(bottles: BottleRow[]): TopEntry[] {
  const groups = new Map<string, { entry: TopEntry; sum: number }>();
  for (const b of bottles) {
    if (b.status !== "consumed") continue;
    let g = groups.get(b.vintage_id);
    if (!g) {
      g = { entry: { vintage: b.vintages, count: 0, rating: null, ratedCount: 0, lastDrunk: null, latestBottleId: b.id }, sum: 0 };
      groups.set(b.vintage_id, g);
    }
    const e = g.entry;
    const n = b.quantity || 1;
    e.count += n;
    if (b.rating !== null) {
      g.sum += b.rating * n;
      e.ratedCount += n;
      e.rating = g.sum / e.ratedCount;
    }
    if (b.consumed_at && (!e.lastDrunk || b.consumed_at > e.lastDrunk)) {
      e.lastDrunk = b.consumed_at;
      e.latestBottleId = b.id;
    }
  }
  return [...groups.values()].map((g) => g.entry).sort((a, b) =>
    (a.rating === null ? 1 : 0) - (b.rating === null ? 1 : 0) ||
    (b.rating ?? 0) - (a.rating ?? 0) ||
    b.count - a.count ||
    (b.lastDrunk ?? "").localeCompare(a.lastDrunk ?? ""),
  );
}
