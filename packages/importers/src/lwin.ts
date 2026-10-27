// Import av LWIN-databasen (Liv-ex, Creative Commons):
// https://www.liv-ex.com/lwin/get-lwin-database
//
// Liv-ex levererar en XLSX-fil. Spara den som CSV (UTF-8) och kör importen
// på CSV-filen. Endast viner med status "Live" importeras; sprit hoppas över.

import { parse } from "csv-parse";
import type { Readable } from "node:stream";
import type { WineColor } from "@trand-vine/core";
import { csvRow, type Writer } from "./sql.ts";

const REQUIRED = ["LWIN", "STATUS", "DISPLAY_NAME", "PRODUCER_NAME", "COUNTRY", "REGION", "COLOUR", "TYPE"];

export interface LwinWine {
  lwin: string;
  name: string;
  producer: string | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  color: WineColor | null;
}

export function mapLwinRow(row: Record<string, string>): LwinWine | null {
  const get = (k: string) => row[k]?.trim() || null;
  const status = (get("STATUS") ?? "").toLowerCase();
  const type = (get("TYPE") ?? "").toLowerCase();
  const subType = (get("SUB_TYPE") ?? "").toLowerCase();
  const colour = (get("COLOUR") ?? "").toLowerCase();
  const lwin = get("LWIN");
  const name = get("DISPLAY_NAME");
  if (!lwin || !name || status !== "live" || !type.includes("wine")) return null;

  let color: WineColor | null = null;
  if (type.includes("fortified")) color = "fortified";
  else if (subType.includes("sparkling") || type.includes("champagne")) color = "sparkling";
  else if (subType.includes("sweet") || subType.includes("dessert")) color = "dessert";
  else if (colour.startsWith("red")) color = "red";
  else if (colour.startsWith("white")) color = "white";
  else if (colour.startsWith("ros")) color = "rose";

  return {
    lwin,
    name,
    producer: get("PRODUCER_NAME"),
    country: get("COUNTRY"),
    region: get("REGION"),
    appellation: get("SUB_REGION"),
    color,
  };
}

export async function writeLwinSql(input: Readable, out: Writer): Promise<{ wines: number }> {
  out.write(`\\set ON_ERROR_STOP on
begin;
create temp table lwin_wines (
  lwin text, name text, producer text, country text, region text, appellation text, color wine_color
) on commit drop;
copy lwin_wines from stdin with (format csv);
`);
  let count = 0;
  let checked = false;
  const rows = input.pipe(parse({ columns: true, bom: true })) as AsyncIterable<Record<string, string>>;
  for await (const row of rows) {
    if (!checked) {
      const missing = REQUIRED.filter((k) => !(k in row));
      if (missing.length) throw new Error(`LWIN-filen saknar kolumner: ${missing.join(", ")}`);
      checked = true;
    }
    const w = mapLwinRow(row);
    if (!w) continue;
    out.write(csvRow([w.lwin, w.name, w.producer, w.country, w.region, w.appellation, w.color]));
    count++;
  }
  out.write(`\\.

insert into wines (lwin, name, producer, country, region, appellation, color, source)
select lwin, name, producer, country, region, appellation, color, 'lwin'
from lwin_wines
on conflict (lwin) do update set
  name = excluded.name, producer = excluded.producer, country = excluded.country,
  region = excluded.region, appellation = excluded.appellation, color = excluded.color;
commit;
`);
  return { wines: count };
}
