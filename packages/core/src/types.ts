// Delade domäntyper. Speglar databasschemat i backend/supabase/migrations.

export type WineColor =
  | "red"
  | "white"
  | "rose"
  | "sparkling"
  | "dessert"
  | "fortified";

export type AcquisitionType =
  | "purchase"
  | "gift"
  | "tasting"
  | "inheritance"
  | "trade"
  | "other";

export type BottleStatus = "in_cellar" | "consumed" | "given_away" | "broken";

export interface Wine {
  id: string;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  color: WineColor | null;
  grapes: string[];
  abv: number | null;
  lwin: string | null;
  xwinesId: string | null;
}

export interface Vintage {
  id: string;
  wineId: string;
  /** null = icke-årgångsvin (NV) */
  year: number | null;
  avgRating: number | null;
  ratingCount: number;
}

export interface Bottle {
  id: string;
  userId: string;
  vintageId: string;
  sizeMl: number;
  acquisitionType: AcquisitionType;
  acquiredAt: string | null;
  price: number | null;
  currency: string | null;
  store: string | null;
  giftFrom: string | null;
  occasionNote: string | null;
  location: string | null;
  status: BottleStatus;
  consumedAt: string | null;
  consumedWith: string | null;
  consumedFood: string | null;
  rating: number | null;
  notes: string | null;
}

/** Ett möjligt vin som en extern källa returnerat för en streckkod. */
export interface WineCandidate {
  source: string;
  sourceId: string;
  ean?: string;
  name: string;
  producer?: string;
  country?: string;
  region?: string;
  color?: WineColor;
  grapes?: string[];
  abv?: number;
  vintage?: number;
  bottleSizeMl?: number;
  imageUrl?: string;
}

export interface WineProvider {
  name: string;
  lookupByBarcode(ean: string): Promise<WineCandidate[]>;
}
