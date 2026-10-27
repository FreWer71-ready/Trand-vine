# Trand-vine

Vinapp: skanna streckkoden på en flaska → appen hittar vinet, visar betyg från
andra användare, du anger hur du fick flaskan (köp, gåva, …) och får råd om
lagring, drickfönster, servering, mat och tillfälle. Har du haft vinet förut
visas din historik direkt.

Bakgrund och beslut: [docs/ARKITEKTUR.md](docs/ARKITEKTUR.md).

<p>
  <img src="docs/screenshots/cellar.png" width="240" alt="Källare" />
  <img src="docs/screenshots/bottle.png" width="240" alt="Flaskdetalj" />
  <img src="docs/screenshots/register.png" width="240" alt="Registrera flaska" />
</p>

## Struktur

```
apps/mobile/            Expo-app (iOS, Android, webb) – expo-router, expo-camera
packages/core/          Delad logik: streckkoder, datakällor, regelmotor för råd, texter sv/en
packages/importers/     Import av öppna dataset (X-Wines, LWIN) till databasen
backend/supabase/       Databasschema (Postgres + RLS), serverfunktion lookup-barcode, tester
scripts/test-db.sh      Kör databastester mot en temporär lokal Postgres
```

## Datakällor (gratis)

| Källa | Används till |
|---|---|
| Egen databas | Bekräftade streckkoder → vin. Växer för varje användare som registrerar en flaska. |
| [Open Food Facts](https://world.openfoodfacts.org) | Streckkod → produkt (öppet API) |
| [UPCitemdb](https://www.upcitemdb.com) | Streckkod → produkt (100 uppslag/dag gratis) |
| [X-Wines](https://github.com/rogerioxavier/X-Wines) (CC0) | ~100 000 viner, druvor, matkombinationer och 21 milj. betyg som startbetyg |
| [LWIN](https://www.liv-ex.com/lwin/get-lwin-database) (CC) | 200 000+ viner för sökning och identifiering |

Råden kommer från en regelmotor (`packages/core/src/recommend.ts`) som körs i
appen – gratis och fungerar offline.

## Kom igång

Kräver Node 20+ och ett (gratis) [Supabase](https://supabase.com)-projekt.

```bash
npm install
```

### 1. Databas och serverfunktion

```bash
npx supabase --workdir backend link --project-ref <projekt-ref>
npx supabase --workdir backend db push                          # schema
npx supabase --workdir backend functions deploy lookup-barcode  # streckkodsuppslag
```

I Supabase: **Authentication → Email Templates → Magic Link**, lägg till
`{{ .Token }}` i mallen så att e-posten innehåller inloggningskoden.

### 2. Importera vindata (valfritt men rekommenderat)

```bash
# X-Wines: ladda ner Full-versionen (länk i X-Wines README) till data/raw/
npm run xwines -w @trand-vine/importers -- data/raw/XWines_Full_100K_wines.csv data/raw/XWines_Full_21M_ratings.csv > data/raw/xwines.sql
psql "$DATABASE_URL" -f data/raw/xwines.sql

# LWIN: ladda ner XLSX från Liv-ex, spara som CSV (UTF-8)
npm run lwin -w @trand-vine/importers -- data/raw/lwin.csv > data/raw/lwin.sql
psql "$DATABASE_URL" -f data/raw/lwin.sql
```

`DATABASE_URL` finns under **Project Settings → Database → Connection string**.
Importen kan köras om; befintliga rader uppdateras.

X-Wines ska citeras: de Azambuja, R.X.; Morais, A.J.; Filipe, V. *X-Wines: A Wine
Dataset for Recommender Systems and Machine Learning.* Big Data Cogn. Comput.
2023, 7, 20. https://doi.org/10.3390/bdcc7010020

### 3. Starta appen

```bash
cp apps/mobile/.env.example apps/mobile/.env   # fyll i URL och anon-nyckel
cd apps/mobile && npx expo start
```

Kameran kräver en riktig telefon (Expo Go eller development build).

## Tester

```bash
npm test            # enhetstester (core, importers)
npm run typecheck   # TypeScript i alla paket
npm run test:db     # schema, RLS, triggrar och import mot lokal Postgres 15+
```
