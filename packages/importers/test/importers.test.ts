import { createReadStream, readFileSync } from "node:fs";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { mapLwinRow, writeLwinSql } from "../src/lwin.ts";
import { csvField, pgArray } from "../src/sql.ts";
import { mapAlkoRows } from "../src/alkoMap.ts";
import { canonicalEan } from "../src/externalWine.ts";
import { mapVinmonopoletAll } from "../src/vinmonopoletMap.ts";
import { mapSystembolaget, mapSystembolagetAll, writeSystembolagetSql } from "../src/systembolaget.ts";
import { aggregateRatings, mapWine, parsePyList, writeXWinesSql } from "../src/xwines.ts";

const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname;
const collect = () => {
  let text = "";
  return { write: (s: string) => void (text += s), get text() { return text; } };
};

describe("sql helpers", () => {
  it("quotes CSV fields and builds arrays", () => {
    expect(csvField(null)).toBe("");
    expect(csvField("")).toBe('""');
    expect(csvField('Say "hi", ok')).toBe('"Say ""hi"", ok"');
    expect(pgArray(["Merlot", 'Sy"rah'])).toBe('{"Merlot","Sy\\"rah"}');
  });
});

describe("X-Wines", () => {
  it("parses Python list literals", () => {
    expect(parsePyList("['Merlot', 'Cabernet Sauvignon']")).toEqual(["Merlot", "Cabernet Sauvignon"]);
    expect(parsePyList(`["Nero d'Avola"]`)).toEqual(["Nero d'Avola"]);
    expect(parsePyList("[]")).toEqual([]);
  });

  it("maps a wine row", () => {
    const w = mapWine({
      WineID: "100062", WineName: "Origem Merlot", Type: "Red", Grapes: "['Merlot']",
      Harmonize: "['Beef', 'Lamb', 'Veal', 'Grilled', 'Pizza', 'Pasta']", ABV: "13.0",
      Body: "Full-bodied", Acidity: "Medium", Country: "Brazil", RegionName: "Vale dos Vinhedos",
      WineryName: "Casa Valduga",
    });
    expect(w).toMatchObject({
      color: "red", grapes: ["Merlot"], abv: 13, producer: "Casa Valduga",
      food: ["red_meat", "lamb", "bbq", "pizza", "pasta_tomato"],
    });
    expect(mapWine({ WineID: "1", WineName: "x", Type: "Dessert/Port" }).color).toBe("fortified");
  });

  it("aggregates ratings per wine and vintage, NV separately", async () => {
    const csv = "RatingID,UserID,WineID,Vintage,Rating,Date\n1,1,9,2015,4.0,x\n2,2,9,2015,5.0,x\n3,3,9,N.V.,3.0,x\n4,4,9,2015,9,x\n";
    const res = await aggregateRatings(Readable.from([csv]));
    expect(res).toContainEqual({ xwinesId: "9", year: 2015, avg: 4.5, count: 2 });
    expect(res).toContainEqual({ xwinesId: "9", year: null, avg: 3, count: 1 });
  });

  it("writes SQL for the test dataset", async () => {
    const out = collect();
    const res = await writeXWinesSql(
      createReadStream(fixture("xwines_wines.csv")),
      createReadStream(fixture("xwines_ratings.csv")),
      out,
    );
    expect(res.wines).toBe(100);
    expect(res.vintages).toBeGreaterThan(0);
    expect(out.text).toMatch(/^\\set ON_ERROR_STOP on\n/);
    expect(out.text).toContain("set statement_timeout = 0;\nbegin;");
    expect(out.text.trimEnd().endsWith("commit;")).toBe(true);
  });
});

describe("LWIN", () => {
  it("maps live wines and skips deleted entries and spirits", () => {
    const base = { LWIN: "1", STATUS: "Live", DISPLAY_NAME: "X", COLOUR: "Red", TYPE: "Wine" };
    expect(mapLwinRow(base)?.color).toBe("red");
    expect(mapLwinRow({ ...base, SUB_TYPE: "Sparkling", COLOUR: "White" })?.color).toBe("sparkling");
    expect(mapLwinRow({ ...base, TYPE: "Fortified Wine" })?.color).toBe("fortified");
    expect(mapLwinRow({ ...base, STATUS: "Deleted" })).toBeNull();
    expect(mapLwinRow({ ...base, TYPE: "Spirit" })).toBeNull();
  });

  it("writes SQL for the sample file", async () => {
    const out = collect();
    expect(await writeLwinSql(createReadStream(fixture("lwin_sample.csv")), out)).toEqual({ wines: 3 });
  });

  it("fails clearly when columns are missing", async () => {
    await expect(writeLwinSql(Readable.from(["foo,bar\n1,2\n"]), collect())).rejects.toThrow(/saknar kolumner: LWIN/);
  });
});

describe("Systembolaget", () => {
  const products = JSON.parse(readFileSync(fixture("systembolaget_sample.json"), "utf8"));

  it("maps wines and skips beer and wine boxes", () => {
    const wines = mapSystembolagetAll(products);
    expect(wines.map((w) => w.productNumber)).toEqual(["5570901", "7243102", "7082801"]);
    expect(wines[0]).toMatchObject({
      shortNumber: "55709", name: "Amarone della Valpolicella", country: "Italy", color: "red",
      vintage: 2018, volumeMl: 750, food: ["lamb", "red_meat", "game"],
      price: 999, // dubbletten med samma nummer vinner
    });
    expect(wines[1]).toMatchObject({ color: "dessert", country: "Cyprus" });
    expect(wines[2]).toMatchObject({ name: ".Collection Secrète", color: "sparkling" });
    expect(mapSystembolaget({ categoryLevel1: "Vin", categoryLevel2: "Rött vin", productNumber: "1" })).toBeNull();
  });

  it("writes SQL calling the import function", () => {
    const out = collect();
    const res = writeSystembolagetSql(products, out);
    expect(res.wines).toBe(3);
    expect(out.text).toMatch(/select private\.import_systembolaget\(\$sb\$\[.*\]\$sb\$::jsonb\);/);
  });
});

describe("Alko", () => {
  const header = ["Numero", "Nimi", "Valmistaja", "Pullokoko", "Hinta", "Litrahinta", "Uutuus", "Hinnastojärjestyskoodi",
    "Tyyppi", "Alatyyppi", "Erityisryhmä", "Oluttyyppi", "Valmistusmaa", "Alue", "Vuosikerta", "Etikettimerkintöjä",
    "Huomautus", "Rypäleet", "Luonnehdinta", "Pakkaustyyppi", "Suljentatyyppi", "Alkoholi-%", "Hapot g/l", "Sokeri g/l",
    "Kantavierrep-%", "Väri EBC", "Katkerot EBU", "Energia kcal/100 ml", "Valikoima", "EAN"];
  const row = (o: Record<string, unknown>) => header.map((h) => o[h] ?? null);
  const rows: unknown[][] = [
    ["Alkon hinnasto 28.10.2026"],
    [],
    header,
    row({ Numero: "906458", Nimi: "Fair & Square Red 2024", Valmistaja: "La Riojana", Pullokoko: "0.75 l", Tyyppi: "punaviinit",
      Valmistusmaa: "Argentiina", Alue: "La Rioja", Vuosikerta: 2024, Rypäleet: "Syrah, Merlot", "Alkoholi-%": 13, EAN: "7350084980013" }),
    row({ Numero: "1", Nimi: "Lager", Tyyppi: "oluet", EAN: "7350084980013" }),
    row({ Numero: "2", Nimi: "Porto Tawny", Tyyppi: "jälkiruokaviinit, väkevöidyt ja muut viinit", "Alkoholi-%": 19.5, Pullokoko: "1,5 l", EAN: "123" }),
  ];

  it("finds the header row and maps wines with barcodes", () => {
    const wines = mapAlkoRows(rows);
    expect(wines).toHaveLength(2);
    expect(wines[0]).toMatchObject({
      ref: "906458", eans: ["7350084980013"], name: "Fair & Square Red", producer: "La Riojana",
      country: "Argentina", color: "red", grapes: ["Syrah", "Merlot"], vintage: 2024, volumeMl: 750, abv: 13,
    });
    expect(wines[1]).toMatchObject({ color: "fortified", eans: [], volumeMl: 1500 });
  });

  it("fails clearly when the header is missing", () => {
    expect(() => mapAlkoRows([["x"]])).toThrow(/rubrikraden/);
  });
});

describe("Vinmonopolet", () => {
  it("maps a product with GTIN, reading fields defensively", () => {
    const wines = mapVinmonopoletAll([
      {
        basic: { productId: "1234501", productShortName: "Barolo 2019", vintage: "2019", volume: 0.75, alcoholContent: 14.5 },
        logistics: { barcodes: [{ gtin: "07350084980013", isMainGtin: true }], manufacturerName: "Cantina Rossi" },
        origins: { origin: { country: "Italia", region: "Piemonte" } },
        classification: { mainProductTypeName: "Rødvin" },
        ingredients: { grapes: [{ grapeDesc: "Nebbiolo" }] },
      },
      { basic: { productId: "9", productShortName: "Akevitt" }, classification: { mainProductTypeName: "Brennevin" } },
    ]);
    expect(wines).toEqual([{
      ref: "1234501", eans: ["7350084980013"], name: "Barolo", producer: "Cantina Rossi", country: "Italy",
      region: "Piemonte", color: "red", grapes: ["Nebbiolo"], abv: 14.5, vintage: 2019, volumeMl: 750,
    }]);
  });

  it("normalizes barcodes like the app does", () => {
    expect(canonicalEan("012345678905")).toBe("0012345678905");
    expect(canonicalEan("7350084980013")).toBe("7350084980013");
    expect(canonicalEan("7350084980014")).toBeNull();
    expect(canonicalEan(7350084980013)).toBe("7350084980013");
  });
});
