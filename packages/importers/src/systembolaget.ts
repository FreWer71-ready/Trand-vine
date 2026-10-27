// Import av Systembolagets sortiment (JSON i det gamla API-formatet).
//
//   npm run systembolaget -w @trand-vine/importers -- assortment.json > sb.sql
//   psql "$DATABASE_URL" -f sb.sql

import { mapSystembolagetAll, type SystembolagetProduct } from "./systembolagetMap.ts";
import type { Writer } from "./sql.ts";

export { mapSystembolaget, mapSystembolagetAll } from "./systembolagetMap.ts";

const BATCH = 1000;

/** Skriver ett psql-skript som anropar private.import_systembolaget i omgångar. */
export function writeSystembolagetSql(products: SystembolagetProduct[], out: Writer): { wines: number } {
  const wines = mapSystembolagetAll(products);
  out.write("\\set ON_ERROR_STOP on\nset statement_timeout = 0;\nbegin;\n");
  for (let i = 0; i < wines.length; i += BATCH) {
    const json = JSON.stringify(wines.slice(i, i + BATCH));
    // Dollarcitat med eget märke, så att citattecken i namnen inte spelar roll.
    if (json.includes("$sb$")) throw new Error("ogiltigt tecken i data");
    out.write(`select private.import_systembolaget($sb$${json}$sb$::jsonb);\n`);
  }
  out.write("commit;\n");
  return { wines: wines.length };
}
