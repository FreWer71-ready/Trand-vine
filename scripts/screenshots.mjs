// Tar skärmdumpar av webbappen till trand.se/wine.html (375×812, mörkt läge).
//
// Appen körs mot en FALSK backend med påhittade viner (DEMODATA): alla anrop
// till Supabase fångas i webbläsaren och besvaras härifrån. Ingen riktig databas
// eller användardata används.
//
//   EXPO_PUBLIC_SUPABASE_URL=https://demo.supabase.test EXPO_PUBLIC_SUPABASE_ANON_KEY=demo \
//     npx expo export --platform web --output-dir /tmp/dist   (i apps/mobile)
//   node scripts/screenshots.mjs /tmp/dist docs/screenshots/trand-se
//
// Kräver Playwright (och en Chromium) installerat.

import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const [distArg, outArg] = process.argv.slice(2);
if (!distArg || !outArg) throw new Error("Användning: node scripts/screenshots.mjs <dist> <utkatalog>");
const dist = resolve(distArg);
const out = resolve(outArg);
mkdirSync(out, { recursive: true });

// ------------------------------------------------------------ demodata ---

const UID = "00000000-0000-4000-8000-000000000001";
const SUPA = "https://demo.supabase.test";
const now = Date.now();
const day = 86_400_000;
const iso = (offsetDays) => new Date(now - offsetDays * day).toISOString();

/** Påhittade viner och producenter; inget av detta finns på riktigt. */
const wine = (id, producer, name, color, country, region, grapes, extra = {}) => ({
  id, producer, name, color, country, region, appellation: null, grapes, abv: 13.5,
  food_pairings: [], image_url: null, systembolaget_nr: null, ...extra,
});
const W = {
  barolo: wine("w1", "Tenuta Collina Verde", "Barolo", "red", "Italien", "Barolo", ["Nebbiolo"]),
  amarone: wine("w2", "Cantina Monte Rosso", "Amarone della Valpolicella", "red", "Italien", "Amarone della Valpolicella", ["Corvina", "Rondinella"], { systembolaget_nr: "9000001" }),
  malbec: wine("w3", "Bodega Valle Alta", "Malbec Reserva", "red", "Argentina", "Mendoza", ["Malbec"]),
  chateauneuf: wine("w4", "Domaine des Trois Chênes", "Châteauneuf-du-Pape", "red", "Frankrike", "Châteauneuf-du-Pape", ["Grenache", "Syrah"]),
  riesling: wine("w5", "Weingut Sonnenhang", "Riesling Kabinett", "white", "Tyskland", "Mosel", ["Riesling"]),
  chablis: wine("w6", "Maison Beauclair", "Chablis Premier Cru", "white", "Frankrike", "Chablis", ["Chardonnay"]),
  brut: wine("w7", "Maison Beauclair", "Brut Réserve", "sparkling", "Frankrike", "Champagne", ["Chardonnay", "Pinot Noir"]),
};
// Samma vin hos "Systembolaget" (för prisindikationen på Malbec, som saknar koppling).
const SB_MALBEC = wine("sb3", "Bodega Valle Alta", "Valle Alta Malbec Reserva", "red", "Argentina", "Mendoza", ["Malbec"], { systembolaget_nr: "9000003" });

let n = 0;
const vint = (w, year) => ({ id: `v${++n}`, wine_id: w.id, year, avg_rating: 4.2, rating_count: 31, wines: w });
const bottle = (w, year, o = {}) => ({
  id: `b${n + 1}`, vintage_id: `v${n + 1}`, size_ml: 750, quantity: 1, acquisition_type: "purchase",
  acquired_at: "2025-03-14", price: null, currency: null, store: null, gift_from: null, occasion_note: null,
  location: null, status: "in_cellar", consumed_at: null, consumed_with: null, consumed_food: null,
  rating: null, notes: null, created_at: iso(30 + n), vintages: vint(w, year), ...o,
});
const BOTTLES = [
  bottle(W.barolo, 2019, { quantity: 2, price: 289, currency: "SEK", store: "Systembolaget", location: "Hylla 2" }),
  bottle(W.amarone, 2018, { quantity: 3, location: "Hylla 1" }),
  bottle(W.malbec, 2021, { location: "Hylla 3" }),
  bottle(W.chateauneuf, 2020, { price: 349, currency: "SEK", location: "Hylla 2" }),
  bottle(W.riesling, 2022, { quantity: 2, price: 159, currency: "SEK", location: "Kyl" }),
  bottle(W.chablis, 2021, { price: 249, currency: "SEK", location: "Kyl" }),
  bottle(W.brut, null, { price: 399, currency: "SEK", location: "Kyl" }),
];
const PRODUCTS = [
  { wine_id: "w2", short_number: "90001", vintage: 2018, volume_ml: 750, price: 249 },
  { wine_id: "sb3", short_number: "90003", vintage: 2022, volume_ml: 750, price: 169 },
];
const HISTORY = [{ bottle_id: "old1", year: 2016, acquisition_type: "gift", gift_from: "Anna", rating: 5, notes: "Perfekt till grytan", status: "consumed" }];

// ------------------------------------------------------ falsk backend ---

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: UID, role: "authenticated", exp: Math.floor(now / 1000) + 86_400 * 30 })}.demo`;
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "", is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: iso(60) };
const session = { access_token: jwt, refresh_token: "demo", token_type: "bearer", expires_in: 2_592_000, expires_at: Math.floor(now / 1000) + 2_592_000, user };
const PROFILE = { id: UID, display_name: "Demo", locale: "sv", approved_at: iso(59), invite_code: "DEMO" };

const unhandled = new Set();

function respond(url, headers) {
  const path = url.pathname;
  const q = url.searchParams;
  const one = /pgrst\.object/.test(headers.accept ?? "");
  const pick = (rows) => (one ? (rows[0] ?? null) : rows);
  if (path === "/auth/v1/user") return user;
  if (path === "/rest/v1/profiles") return pick([PROFILE]);
  if (path === "/rest/v1/rpc/is_admin") return false;
  if (path === "/rest/v1/rpc/my_wine_history") return HISTORY;
  if (path === "/rest/v1/rpc/wikidata_lookup") return { grapes: [], regions: [] };
  if (path === "/rest/v1/wine_ratings") return pick([{ avg_rating: 4.2, rating_count: 31 }]);
  if (path === "/rest/v1/systembolaget_products") return PRODUCTS;
  if (path === "/rest/v1/bottles") {
    const id = (q.get("id") ?? "").replace("eq.", "");
    if (id) return pick(BOTTLES.filter((b) => b.id === id));
    const status = q.get("status") ?? "";
    return status.includes("in_cellar") ? BOTTLES : [];
  }
  if (path === "/rest/v1/wines") {
    // Namnsökning mot Systembolagets viner (prisindikationen) eller hämta ett vin.
    if (q.get("systembolaget_nr")) return /malbec|valle|alta|bodega/i.test(q.get("search_text") ?? "") ? [SB_MALBEC] : [];
    const id = (q.get("id") ?? "").replace("eq.", "");
    return pick(Object.values(W).filter((w) => w.id === id));
  }
  if (path === "/rest/v1/rpc/search_wines") {
    const term = String(headers.__body?.q ?? "").toLowerCase();
    return Object.values(W).filter((w) => `${w.producer} ${w.name} ${w.region}`.toLowerCase().includes(term));
  }
  return undefined;
}

// ---------------------------------------------------- statisk server ---

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".ico": "image/x-icon", ".png": "image/png", ".ttf": "font/ttf", ".json": "application/json" };
const server = createServer((req, res) => {
  const file = join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  const target = existsSync(file) && statSync(file).isFile() ? file : join(dist, "index.html"); // SPA
  res.writeHead(200, { "content-type": TYPES[extname(target)] ?? "application/octet-stream" });
  res.end(readFileSync(target));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

// ------------------------------------------------------------ skott ---

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  locale: "sv-SE",
  isMobile: true,
  hasTouch: true,
});
await ctx.addInitScript(([key, value]) => localStorage.setItem(key, value), ["sb-demo-auth-token", JSON.stringify(session)]);
await ctx.route(`${SUPA}/**`, async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const headers = { ...req.headers() };
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors() });
  try {
    headers.__body = req.postData() ? JSON.parse(req.postData()) : undefined;
  } catch { /* ingen JSON */ }
  const body = respond(url, headers);
  if (body === undefined) {
    unhandled.add(`${req.method()} ${url.pathname}${url.search.slice(0, 80)}`);
    return route.fulfill({ status: 200, headers: cors(), contentType: "application/json", body: "[]" });
  }
  return route.fulfill({ status: 200, headers: cors(), contentType: "application/json", body: JSON.stringify(body) });
});
const cors = () => ({ "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" });

const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("sidfel:", e.message));
const shot = async (name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out, name) });
  console.log("sparad", name);
};

await page.goto(base, { waitUntil: "networkidle" });
await page.getByText("Källare").first().waitFor({ timeout: 20_000 });
await page.waitForTimeout(1500); // Systembolagets priser hämtas efter listan
// Scrolla förbi sorteringsknapparna så att grupper, antal och priser syns.
await page.getByText("Rött · 7").first().evaluate((el) => el.scrollIntoView({ block: "start" }));
await page.evaluate(() => {
  for (const el of document.querySelectorAll("div")) if (el.scrollTop > 0) el.scrollTop -= 8;
});
await shot("wine-kallare.png");

// Flaskans detaljer.
await page.getByText("Barolo", { exact: false }).first().click();
await page.waitForTimeout(1200);
await shot("wine-flaska.png");

// Lägg till en flaska: sök och välj vin.
await page.goto(base, { waitUntil: "networkidle" });
await page.getByText("Lägg till flaska").first().click();
await page.locator("input").first().fill("amarone");
await page.waitForTimeout(1500);
await page.locator("text=/Cantina Monte Rosso/ >> visible=true").first().click();
await page.waitForTimeout(1000);
await shot("wine-lagg-till.png");

console.log("Ej hanterade anrop:", [...unhandled]);
await browser.close();
server.close();
