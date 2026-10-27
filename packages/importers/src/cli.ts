// Skapar psql-skript för import av öppna vindataset.
//
//   npm run xwines -w @trand-vine/importers -- <viner.csv> [betyg.csv] > xwines.sql
//   npm run lwin -w @trand-vine/importers -- <lwin.csv> > lwin.sql
//   npm run systembolaget -w @trand-vine/importers -- <assortment.json> > sb.sql
//   psql "$DATABASE_URL" -f xwines.sql

import { createReadStream, readFileSync } from "node:fs";
import { writeLwinSql } from "./lwin.ts";
import { writeSystembolagetSql } from "./systembolaget.ts";
import { writeXWinesSql } from "./xwines.ts";

const [command, ...files] = process.argv.slice(2);
const out = { write: (s: string) => void process.stdout.write(s) };

async function main() {
  if (command === "xwines" && files[0]) {
    const res = await writeXWinesSql(
      createReadStream(files[0]),
      files[1] ? createReadStream(files[1]) : null,
      out,
    );
    console.error(`X-Wines: ${res.wines} viner, ${res.vintages} årgångar med betyg`);
  } else if (command === "lwin" && files[0]) {
    const res = await writeLwinSql(createReadStream(files[0]), out);
    console.error(`LWIN: ${res.wines} viner`);
  } else if (command === "systembolaget" && files[0]) {
    const res = writeSystembolagetSql(JSON.parse(readFileSync(files[0], "utf8")), out);
    console.error(`Systembolaget: ${res.wines} viner`);
  } else {
    console.error("Användning: cli.ts xwines <viner.csv> [betyg.csv] | lwin <lwin.csv> | systembolaget <assortment.json>");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
