// Översättning av Systembolagets produktdata till Trand-vines vinmodell.
//
// Systembolaget har inget öppet API längre; datan kommer från speglar som
// sparar deras sortiment i samma format som det gamla API:t, t.ex.
// github.com/AlexGustafsson/systembolaget-api-data och
// github.com/C4illin/systembolaget-data. Streckkoder ingår inte.
//
// Fristående (inga beroenden) så att samma kod används av importverktyget
// och av Supabase-funktionen import-xwines.

export type SbColor = "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified";

export interface SystembolagetProduct {
  productNumber?: string | null;
  productNumberShort?: string | null;
  productNameBold?: string | null;
  productNameThin?: string | null;
  producerName?: string | null;
  categoryLevel1?: string | null;
  categoryLevel2?: string | null;
  categoryLevel3?: string | null;
  country?: string | null;
  originLevel1?: string | null;
  originLevel2?: string | null;
  grapes?: string[] | null;
  alcoholPercentage?: number | null;
  vintage?: string | number | null;
  volume?: number | null;
  price?: number | null;
  tasteSymbols?: string[] | null;
  images?: Array<{ imageUrl?: string | null }> | null;
  isDiscontinued?: boolean | null;
}

export interface SystembolagetWine {
  productNumber: string;
  shortNumber: string;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  color: SbColor | null;
  grapes: string[];
  abv: number | null;
  food: string[];
  imageUrl: string | null;
  vintage: number | null;
  volumeMl: number | null;
  price: number | null;
}

const COLORS: Record<string, SbColor> = {
  "Rött vin": "red",
  "Vitt vin": "white",
  "Rosévin": "rose",
  "Mousserande vin": "sparkling",
  "Starkvin": "fortified",
};

// Systembolagets matsymboler → FoodKey i packages/core.
const FOODS: Record<string, string[]> = {
  "Nöt": ["red_meat"],
  "Lamm": ["lamb"],
  "Vilt": ["game"],
  "Fläsk": ["pork"],
  "Fågel": ["poultry"],
  "Fisk": ["fish"],
  "Skaldjur": ["shellfish"],
  "Grönsaker": ["vegetarian"],
  "Ost": ["hard_cheese"],
  "Asiatiskt": ["spicy_asian"],
  "Kryddstarkt": ["spicy_asian"],
  "Dessert": ["dessert_fruit"],
  "Aperitif": ["aperitif_snacks"],
  "Sällskapsdryck": ["aperitif_snacks"],
  "Buffémat": ["charcuterie"],
};

// Landsnamn på engelska, som i övriga registret (X-Wines, LWIN).
const COUNTRIES: Record<string, string> = {
  Frankrike: "France", Italien: "Italy", Spanien: "Spain", USA: "United States",
  Sydafrika: "South Africa", Portugal: "Portugal", Tyskland: "Germany", Chile: "Chile",
  Sverige: "Sweden", Australien: "Australia", Argentina: "Argentina", "Österrike": "Austria",
  "Nya Zeeland": "New Zealand", Grekland: "Greece", Ungern: "Hungary", Libanon: "Lebanon",
  Schweiz: "Switzerland", Japan: "Japan", Storbritannien: "United Kingdom", Ukraina: "Ukraine",
  Georgien: "Georgia", Nordmakedonien: "North Macedonia", "Rumänien": "Romania",
  Slovenien: "Slovenia", Serbien: "Serbia", Bulgarien: "Bulgaria", Cypern: "Cyprus",
  Finland: "Finland", Moldavien: "Moldova", Tjeckien: "Czech Republic", Uruguay: "Uruguay",
  Norge: "Norway", Kroatien: "Croatia", Danmark: "Denmark", "Folkrepubliken Kina": "China",
  Israel: "Israel", Armenien: "Armenia", Kanada: "Canada", Marocko: "Morocco",
  Turkiet: "Turkey", Brasilien: "Brazil", Mexiko: "Mexico", Luxemburg: "Luxembourg",
  Slovakien: "Slovakia", Polen: "Poland", Belgien: "Belgium", Nederländerna: "Netherlands",
};

const clean = (s: string | null | undefined) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t || null;
};

/** Vin från Systembolaget, eller null för annat (öl, sprit, vinlådor, glögg …). */
export function mapSystembolaget(p: SystembolagetProduct): SystembolagetWine | null {
  if (p.categoryLevel1 !== "Vin") return null;
  const category = p.categoryLevel2 ?? "";
  if (!(category in COLORS)) return null;
  const productNumber = clean(p.productNumber);
  const bold = clean(p.productNameBold);
  if (!productNumber || !bold) return null;

  const thin = clean(p.productNameThin);
  const sweet = /sött/i.test(p.categoryLevel3 ?? "");
  const color = sweet && (category === "Vitt vin" || category === "Rött vin") ? "dessert" : COLORS[category]!;
  const country = clean(p.country);
  const vintage = Number(p.vintage);
  const image = clean(p.images?.[0]?.imageUrl);

  return {
    productNumber,
    // Hyllkanten och kvittot visar det korta numret (utan förpackningssiffror).
    shortNumber: clean(p.productNumberShort) ?? productNumber.slice(0, -2),
    name: thin ? `${bold} ${thin}` : bold,
    producer: clean(p.producerName),
    country: country && !/varierande|internationellt|^EU$/i.test(country) ? (COUNTRIES[country] ?? country) : null,
    region: clean(p.originLevel1),
    appellation: clean(p.originLevel2),
    color,
    grapes: (p.grapes ?? []).map((g) => g.trim()).filter(Boolean),
    abv: typeof p.alcoholPercentage === "number" && p.alcoholPercentage > 0 && p.alcoholPercentage <= 30 ? p.alcoholPercentage : null,
    food: [...new Set((p.tasteSymbols ?? []).flatMap((s) => FOODS[s] ?? []))],
    imageUrl: image ? `${image}_400.png` : null,
    vintage: Number.isInteger(vintage) && vintage >= 1800 && vintage <= 2200 ? vintage : null,
    volumeMl: typeof p.volume === "number" && p.volume > 0 ? Math.round(p.volume) : null,
    price: typeof p.price === "number" && p.price >= 0 ? p.price : null,
  };
}

/** Mappar och tar bort dubbletter (samma artikelnummer förekommer ibland två gånger). */
export function mapSystembolagetAll(products: SystembolagetProduct[]): SystembolagetWine[] {
  const byNumber = new Map<string, SystembolagetWine>();
  for (const p of products) {
    const w = mapSystembolaget(p);
    if (w) byNumber.set(w.productNumber, w);
  }
  return [...byNumber.values()];
}
