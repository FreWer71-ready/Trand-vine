// Importerar X-Wines (CC0) direkt från datasetets Google Drive-mapp till
// databasen. Körs på Supabases servrar, så ingen behöver ladda ner filerna.
//
// Startas med POST och en engångsnyckel från tabellen private.import_tokens
// (skapas med SQL av den som har databasåtkomst, giltig i en timme):
//   { "action": "list" }                       → filerna i mappen
//   { "action": "wines", "fileId": "…", "skip": 0 } → importerar vinfilen
//   { "action": "systembolaget", "url": "…" }   → Systembolagets sortiment (JSON)
//   { "action": "alko", "url": "…", "dryRun": true } → Alkos prislista (xlsx) med streckkoder;
//                                                  url valfri, t.ex. en egen nedladdad kopia
//   { "action": "vinmonopolet", "dryRun": true } → Vinmonopolets API (kräver hemligheten
//                                                  VINMONOPOLET_API_KEY)
// dryRun visar rubriker och exempel utan att spara något.
// Räcker inte en körning (funktionerna har begränsad datorkraft) svarar den
// med var den slutade; kör igen med "skip" satt till det värdet.
//
// Betygen (21 miljoner rader) ryms inte i en funktionskörning; importera dem
// med GitHub-flödet "Importera X-Wines" eller importverktyget.

import { CsvParseStream } from "jsr:@std/csv@1/parse-stream";
import postgres from "npm:postgres@3.4.5";
import { mapWine, type XWinesWine } from "../../../../packages/importers/src/xwinesMap.ts";
import { mapSystembolagetAll } from "../../../../packages/importers/src/systembolagetMap.ts";
import { ALKO_URL, mapAlkoRows } from "../../../../packages/importers/src/alkoMap.ts";
import { mapVinmonopoletAll, VINMONOPOLET_URL } from "../../../../packages/importers/src/vinmonopoletMap.ts";
import type { ExternalWine } from "../../../../packages/importers/src/externalWine.ts";
import * as XLSX from "npm:xlsx@0.18.5";

// Spegel av Systembolagets sortiment (det officiella API:t är nedlagt).
const SYSTEMBOLAGET_URL =
  "https://raw.githubusercontent.com/AlexGustafsson/systembolaget-api-data/main/data/assortment.json";

const FOLDER_ID = "1LqguJNV-aKh1PuWMVx5ELA61LPfGfuu_";
const BATCH = 2000;

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

interface DriveEntry {
  id: string;
  name: string;
  path: string;
  folder: boolean;
}

/** Listar en publik Drive-mapp via dess inbäddningsvy (ingen API-nyckel). */
async function listFolder(id: string, path = "", depth = 0): Promise<DriveEntry[]> {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`);
  if (!res.ok) throw new Error(`Drive-mappen svarade ${res.status}`);
  const html = await res.text();
  const re =
    /href="https:\/\/drive\.google\.com\/(file\/d|drive\/folders)\/([\w-]+)[^"]*"[\s\S]*?flip-entry-title">([^<]+)</g;
  const out: DriveEntry[] = [];
  for (const m of html.matchAll(re)) {
    const entry = { id: m[2]!, name: m[3]!.trim(), path: `${path}${m[3]!.trim()}`, folder: m[1] !== "file/d" };
    out.push(entry);
    if (entry.folder && depth < 2) out.push(...(await listFolder(entry.id, `${entry.path}/`, depth + 1)));
  }
  return out;
}

async function download(fileId: string): Promise<Response> {
  const res = await fetch(
    `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  );
  if (!res.ok || !res.body) throw new Error(`Nedladdningen svarade ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("text/html")) throw new Error("Google Drive svarade med en webbsida i stället för filen");
  return res;
}

async function upsertWines(batch: XWinesWine[]) {
  const rows = batch.map((w) => ({
    xwines_id: w.xwinesId, name: w.name, producer: w.producer, country: w.country, region: w.region,
    color: w.color, grapes: w.grapes, abv: w.abv, body: w.body, acidity: w.acidity, food_pairings: w.food,
  }));
  await sql`
    insert into wines (xwines_id, name, producer, country, region, color, grapes, abv, body, acidity, food_pairings, source)
    select x.xwines_id, x.name, x.producer, x.country, x.region, x.color::wine_color, x.grapes, x.abv, x.body,
           x.acidity, x.food_pairings, 'xwines'
    from json_to_recordset((${JSON.stringify(rows)}::text)::json) as x(
      xwines_id text, name text, producer text, country text, region text, color text,
      grapes text[], abv numeric, body text, acidity text, food_pairings text[])
    on conflict (xwines_id) do update set
      name = excluded.name, producer = excluded.producer, country = excluded.country,
      region = excluded.region, color = excluded.color, grapes = excluded.grapes, abv = excluded.abv,
      body = excluded.body, acidity = excluded.acidity, food_pairings = excluded.food_pairings`;
}

const MAX_ROWS_PER_RUN = 40000;

async function importWines(fileId: string, skip: number) {
  const res = await download(fileId);
  const records = res.body!
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new CsvParseStream({ skipFirstRow: true }));
  let batch: XWinesWine[] = [];
  let count = 0;
  let seen = 0;
  for await (const row of records as AsyncIterable<Record<string, string>>) {
    if (seen++ < skip) continue;
    if (seen - skip > MAX_ROWS_PER_RUN) {
      if (batch.length) await upsertWines(batch);
      return { wines: count + batch.length, next: seen - 1 };
    }
    if (!row.WineID || !row.WineName) continue;
    batch.push(mapWine(row));
    if (batch.length === BATCH) {
      await upsertWines(batch);
      count += batch.length;
      batch = [];
    }
  }
  if (batch.length) await upsertWines(batch);
  return { wines: count + batch.length, next: null };
}

async function importSystembolaget(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Systembolaget-datan svarade ${res.status}`);
  const wines = mapSystembolagetAll(await res.json());
  for (let i = 0; i < wines.length; i += BATCH) {
    await sql`select private.import_systembolaget((${JSON.stringify(wines.slice(i, i + BATCH))}::text)::jsonb)`;
  }
  return { wines: wines.length };
}

async function importExternal(source: string, wines: ExternalWine[]) {
  let barcodes = 0;
  for (let i = 0; i < wines.length; i += BATCH) {
    const [row] = await sql`
      select private.import_external(${source}, (${JSON.stringify(wines.slice(i, i + BATCH))}::text)::jsonb) as n`;
    barcodes += Number(row?.n ?? 0);
  }
  return { wines: wines.length, newBarcodes: barcodes, withBarcode: wines.filter((w) => w.eans.length).length };
}

async function importAlko(url: string, dryRun: boolean) {
  const res = await fetch(url, { headers: { "User-Agent": "TrandWine/1.0 (vinregister)" } });
  if (!res.ok) throw new Error(`Alko svarade ${res.status}. Ladda ner prislistan själv och ange dess adress som "url".`);
  if ((res.headers.get("content-type") ?? "").includes("text/html")) {
    throw new Error('Alko svarade med en webbsida i stället för filen. Ladda ner prislistan själv och ange dess adress som "url".');
  }
  const book = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]!]!, { header: 1, raw: true, defval: null });
  const wines = mapAlkoRows(rows);
  if (dryRun) {
    const header = rows.find((r) => r.includes("Numero")) ?? [];
    return { dryRun: true, rows: rows.length, wines: wines.length, withBarcode: wines.filter((w) => w.eans.length).length, header, sample: wines.slice(0, 3) };
  }
  return await importExternal("alko", wines);
}

async function importVinmonopolet(dryRun: boolean) {
  const key = Deno.env.get("VINMONOPOLET_API_KEY");
  if (!key) throw new Error("Hemligheten VINMONOPOLET_API_KEY saknas");
  const page = 5000;
  const products: unknown[] = [];
  for (let start = 0; ; start += page) {
    const res = await fetch(`${VINMONOPOLET_URL}?maxResults=${page}&start=${start}`, {
      headers: { "Ocp-Apim-Subscription-Key": key, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Vinmonopolet svarade ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const batch = await res.json();
    if (!Array.isArray(batch)) throw new Error(`Oväntat svar från Vinmonopolet: ${JSON.stringify(batch).slice(0, 200)}`);
    products.push(...batch);
    if (dryRun || batch.length < page) break;
  }
  const wines = mapVinmonopoletAll(products as never[]);
  if (dryRun) {
    return { dryRun: true, products: products.length, wines: wines.length, withBarcode: wines.filter((w) => w.eans.length).length, raw: products.slice(0, 2), sample: wines.slice(0, 3) };
  }
  return await importExternal("vinmonopolet", wines);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const token = req.headers.get("x-import-token") ?? "";
  const [ok] = await sql`
    select 1 from private.import_tokens where token = ${token} and created_at > now() - interval '1 hour'`;
  if (!token || !ok) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const started = Date.now();
  try {
    if (body.action === "list") return json({ files: await listFolder(FOLDER_ID) });
    if (body.action === "wines" && typeof body.fileId === "string") {
      const skip = Number.isInteger(body.skip) && body.skip > 0 ? body.skip : 0;
      const result = await importWines(body.fileId, skip);
      return json({ ...result, seconds: Math.round((Date.now() - started) / 1000) });
    }
    if (body.action === "systembolaget") {
      const url = typeof body.url === "string" && body.url.startsWith("https://") ? body.url : SYSTEMBOLAGET_URL;
      const result = await importSystembolaget(url);
      return json({ ...result, seconds: Math.round((Date.now() - started) / 1000) });
    }
    if (body.action === "alko") {
      const url = typeof body.url === "string" && body.url.startsWith("https://") ? body.url : ALKO_URL;
      const result = await importAlko(url, body.dryRun === true);
      return json({ ...result, seconds: Math.round((Date.now() - started) / 1000) });
    }
    if (body.action === "vinmonopolet") {
      const result = await importVinmonopolet(body.dryRun === true);
      return json({ ...result, seconds: Math.round((Date.now() - started) / 1000) });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
