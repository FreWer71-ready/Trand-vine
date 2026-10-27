import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { mapLwinRow, writeLwinSql } from "../src/lwin.ts";
import { csvField, pgArray } from "../src/sql.ts";
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
    expect(out.text).toMatch(/^\\set ON_ERROR_STOP on\nbegin;/);
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
