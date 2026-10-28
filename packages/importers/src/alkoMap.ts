// Alkos prislista (Finland): alkon-hinnasto-tekstitiedostona.xlsx, gratis
// att ladda ner och uppdateras varje dag. Har en EAN-kolumn, så skanning av
// flaskor som säljs både i Finland och Sverige ger direkt träff.
//
// Raderna kommer som listor (ett kalkylblad); rubrikraden letas upp efter
// namn så att ändrad kolumnordning inte spelar roll.

import { abv, canonicalEan, grapeList, num, stripVintage, text, year, type ExternalColor, type ExternalWine } from "./externalWine.ts";

export const ALKO_URL =
  "https://www.alko.fi/INTERSHOP/static/WFS/Alko-OnlineShop-Site/-/Alko-OnlineShop/fi_FI/Alkon%20Hinnasto%20Tekstitiedostona/alkon-hinnasto-tekstitiedostona.xlsx";

const TYPES: Record<string, ExternalColor> = {
  punaviinit: "red",
  valkoviinit: "white",
  roseeviinit: "rose",
  "kuohuviinit ja samppanjat": "sparkling",
};
const DESSERT_TYPE = "jälkiruokaviinit, väkevöidyt ja muut viinit";

const COUNTRIES: Record<string, string> = {
  Ranska: "France", Italia: "Italy", Espanja: "Spain", Saksa: "Germany", Portugali: "Portugal",
  "Itävalta": "Austria", Chile: "Chile", Argentiina: "Argentina", Australia: "Australia",
  "Uusi-Seelanti": "New Zealand", Yhdysvallat: "United States", "Etelä-Afrikka": "South Africa",
  Unkari: "Hungary", Kreikka: "Greece", Suomi: "Finland", Ruotsi: "Sweden", Georgia: "Georgia",
  Libanon: "Lebanon", Sveitsi: "Switzerland", Slovenia: "Slovenia", Kroatia: "Croatia",
  Romania: "Romania", Bulgaria: "Bulgaria", Moldova: "Moldova", Israel: "Israel", Uruguay: "Uruguay",
  Kanada: "Canada", "Iso-Britannia": "United Kingdom", Englanti: "United Kingdom",
  "Pohjois-Makedonia": "North Macedonia", Turkki: "Turkey", Kypros: "Cyprus", "Tšekki": "Czech Republic",
  Slovakia: "Slovakia", Serbia: "Serbia", Armenia: "Armenia", Japani: "Japan", Kiina: "China",
  Marokko: "Morocco", Brasilia: "Brazil", Meksiko: "Mexico", Luxemburg: "Luxembourg",
};

/** "0.75 l" → 750, "1,5 l" → 1500 */
export function bottleMl(v: unknown): number | null {
  const m = (text(v) ?? "").match(/([\d.,]+)\s*l/i);
  const litres = m ? num(m[1]) : null;
  return litres && litres > 0 ? Math.round(litres * 1000) : null;
}

export function mapAlkoRows(rows: unknown[][]): ExternalWine[] {
  const headerIndex = rows.findIndex((r) => r.some((c) => text(c) === "Numero") && r.some((c) => text(c) === "EAN"));
  if (headerIndex < 0) throw new Error("Alkos prislista: hittar inte rubrikraden (Numero … EAN)");
  const header = rows[headerIndex]!.map((c) => text(c) ?? "");
  const col = (row: unknown[], name: string) => row[header.indexOf(name)];

  const out = new Map<string, ExternalWine>();
  for (const row of rows.slice(headerIndex + 1)) {
    const ref = text(col(row, "Numero"));
    const nameRaw = text(col(row, "Nimi"));
    const type = (text(col(row, "Tyyppi")) ?? "").toLowerCase();
    const strength = abv(col(row, "Alkoholi-%"));
    const color = TYPES[type] ?? (type === DESSERT_TYPE ? (strength !== null && strength >= 15 ? "fortified" : "dessert") : null);
    if (!ref || !nameRaw || !color) continue;
    const vintage = year(col(row, "Vuosikerta"));
    const country = text(col(row, "Valmistusmaa"));
    const ean = canonicalEan(col(row, "EAN"));
    out.set(ref, {
      ref,
      eans: ean ? [ean] : [],
      name: stripVintage(nameRaw, vintage),
      producer: text(col(row, "Valmistaja")),
      country: country ? (COUNTRIES[country] ?? country) : null,
      region: text(col(row, "Alue")),
      color,
      grapes: grapeList(col(row, "Rypäleet")),
      abv: strength,
      vintage,
      volumeMl: bottleMl(col(row, "Pullokoko")),
    });
  }
  return [...out.values()];
}
