// Hämtar druvsorter och vinområden från Wikidata (CC0) till databasen,
// med namn på svenska och engelska, synonymer och länkar till Wikipedia.
// Startas från databasen med en engångsnyckel från private.import_tokens:
//   { "action": "sync", "dryRun": true } → hämtar och visar antal och exempel
//   { "action": "sync" }                 → hämtar och sparar (kan köras om)
//   { "action": "sparql", "query": "…" } → provfråga

import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "Trand-vine/1.0 (https://trandvine.fred71.se; vinregister)";
const GRAPE_VARIETY = "Q958314";
const WINE_REGION = "Q2140699";
const LANGS = `"en","sv","fr","it","es","de","pt"`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Row = Record<string, { value: string } | undefined>;

async function sparql(query: string): Promise<Row[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: new URLSearchParams({ query }),
  });
  if (!res.ok) throw new Error(`Wikidata svarade ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).results.bindings as Row[];
}

// Bara poster som har en Wikipedia-artikel (sv eller en), så att länken går att följa.
const query = (classFilter: string, originProp: string) => `
SELECT ?x ?en ?sv ?originLabel ?wen ?wsv (GROUP_CONCAT(DISTINCT ?alias; separator="|") AS ?aliases) WHERE {
  ${classFilter}
  OPTIONAL { ?wen schema:about ?x; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?wsv schema:about ?x; schema:isPartOf <https://sv.wikipedia.org/> }
  FILTER(BOUND(?wen) || BOUND(?wsv))
  OPTIONAL { ?x rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?x rdfs:label ?sv FILTER(LANG(?sv) = "sv") }
  OPTIONAL { ?x rdfs:label ?l FILTER(LANG(?l) IN (${LANGS})) }
  OPTIONAL { ?x skos:altLabel ?a FILTER(LANG(?a) IN (${LANGS})) }
  BIND(COALESCE(?a, ?l) AS ?alias)
  OPTIONAL { ?x wdt:${originProp} ?origin . ?origin rdfs:label ?originLabel FILTER(LANG(?originLabel) = "en") }
}
GROUP BY ?x ?en ?sv ?originLabel ?wen ?wsv`;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

interface Item {
  id: string; en: string | null; sv: string | null; origin: string | null;
  wikiEn: string | null; wikiSv: string | null; names: string[];
}

function toItems(rows: Row[]): Item[] {
  const byId = new Map<string, Item>();
  for (const r of rows) {
    const id = r.x!.value.split("/").pop()!;
    const item = byId.get(id) ?? {
      id, en: r.en?.value ?? null, sv: r.sv?.value ?? null, origin: null,
      wikiEn: r.wen?.value ?? null, wikiSv: r.wsv?.value ?? null, names: [],
    };
    const names = [r.en?.value, r.sv?.value, ...(r.aliases?.value ?? "").split("|")]
      // "Barolo DOCG" → även "barolo"
      .flatMap((n) => (n ? [n, n.replace(/\s+(AOC|AOP|DOCG|DOC|DO|DOCa|DOQ|AVA|IGT|IGP|GI|wine region|wine)$/i, "")] : []))
      .map(norm)
      .filter((n) => n.length >= 3);
    item.names = [...new Set([...item.names, ...names])];
    // Flera ursprungsländer (t.ex. Tannat: France, Italy) kommer som egna rader.
    const origin = r.originLabel?.value;
    if (origin && !(item.origin ?? "").split(", ").includes(origin)) {
      item.origin = item.origin ? `${item.origin}, ${origin}` : origin;
    }
    byId.set(id, item);
  }
  return [...byId.values()];
}

async function save(kind: "grapes" | "regions", items: Item[]) {
  for (let i = 0; i < items.length; i += 1000) {
    await sql`select private.import_wikidata(${kind}, (${JSON.stringify(items.slice(i, i + 1000))}::text)::jsonb)`;
  }
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
    if (body.action === "sparql" && typeof body.query === "string") {
      const rows = await sparql(body.query);
      return json({ count: rows.length, rows: rows.slice(0, 50) });
    }
    if (body.action === "sync") {
      const grapes = toItems(await sparql(query(`?x wdt:P31 wd:${GRAPE_VARIETY} .`, "P495")));
      const regions = toItems(await sparql(query(`?x wdt:P31/wdt:P279* wd:${WINE_REGION} .`, "P17")));
      if (body.dryRun === true) {
        const pick = (items: Item[], name: string) => items.find((i) => i.names.includes(name));
        return json({
          dryRun: true, grapes: grapes.length, regions: regions.length,
          examples: [pick(grapes, "nebbiolo"), pick(grapes, "tribidrag"), pick(regions, "rioja"), pick(regions, "mosel")],
        });
      }
      await save("grapes", grapes);
      await save("regions", regions);
      return json({ grapes: grapes.length, regions: regions.length, seconds: Math.round((Date.now() - started) / 1000) });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
