// Läser texten på en vinetikett med Google Vision och letar upp vinet i
// registret. Kräver hemligheten GOOGLE_VISION_API_KEY.
//
// POST { "image": "<base64-jpeg>" } med användarens inloggning (JWT).
// Svar: { text, display, vintage, matches: [vin …] }
//
// Gratiskvoten hos Google är 1 000 bilder/månad. För att aldrig gå över den
// begränsas läsningarna per användare och dag och för hela appen per månad.

import postgres from "npm:postgres@3.4.5";
import { labelQueries } from "../../../../packages/core/src/label.ts";

const PER_USER_PER_DAY = 30;
const PER_MONTH = 950;
const MAX_IMAGE_BYTES = 6_000_000;

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Användarens id ur JWT:n. Signaturen är redan kontrollerad av Supabase (verify_jwt). */
function userId(req: Request): string | null {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "authenticated" && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

async function readText(image: string, key: string): Promise<string> {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        image: { content: image },
        features: [{ type: "TEXT_DETECTION" }],
        imageContext: { languageHints: ["en", "fr", "it", "es", "de", "pt", "sv"] },
      }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  const err = body?.error?.message ?? body?.responses?.[0]?.error?.message;
  if (!res.ok || err) throw new Error(`Google Vision: ${err ?? res.status}`);
  return body?.responses?.[0]?.fullTextAnnotation?.text ?? body?.responses?.[0]?.textAnnotations?.[0]?.description ?? "";
}

interface WineHit {
  id: string;
  [key: string]: unknown;
}

/** Söker på varje sökord och rankar vinerna som träffas av flest och bäst. */
async function findWines(queries: string[]) {
  const score = new Map<string, { wine: WineHit; points: number }>();
  for (const [qi, q] of queries.entries()) {
    const rows = await sql<WineHit[]>`select * from search_wines(${q}, 10)`;
    rows.forEach((wine, rank) => {
      const s = score.get(wine.id) ?? { wine, points: 0 };
      // Tidiga sökord (flera rader ihop) och höga placeringar väger mest.
      s.points += (1 / (rank + 1)) * (qi === 0 ? 2 : 1);
      score.set(wine.id, s);
    });
  }
  return [...score.values()].sort((a, b) => b.points - a.points).slice(0, 6).map((s) => {
    const { search_text: _drop, ...wine } = s.wine;
    return wine;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = userId(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const key = Deno.env.get("GOOGLE_VISION_API_KEY");
  if (!key) return json({ error: "not_configured" }, 503);

  const body = await req.json().catch(() => ({}));
  const image = typeof body.image === "string" ? body.image.replace(/^data:image\/\w+;base64,/, "") : "";
  if (!image || image.length > MAX_IMAGE_BYTES * 1.37) return json({ error: "bad_image" }, 400);

  const [usage] = await sql`
    select count(*) filter (where user_id = ${user} and created_at > now() - interval '1 day') as today,
           count(*) filter (where created_at > date_trunc('month', now())) as month
    from private.label_reads where created_at > least(now() - interval '1 day', date_trunc('month', now()))`;
  if (Number(usage?.today) >= PER_USER_PER_DAY || Number(usage?.month) >= PER_MONTH) {
    return json({ error: "quota" }, 429);
  }
  await sql`insert into private.label_reads (user_id) values (${user})`;

  try {
    const text = await readText(image, key);
    const { queries, display, vintage } = labelQueries(text);
    const matches = queries.length ? await findWines(queries) : [];
    return json({ text, display, vintage, matches });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});
