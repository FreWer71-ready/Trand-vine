# Trand-vine – förslag på struktur, källor, API:er och funktioner

> Status: förslag / diskussionsunderlag. Inget är byggt ännu.

## 1. Idé i en mening

Skanna streckkoden på en flaska → appen identifierar vinet, hämtar recensioner och
fakta, du anger hur du fick flaskan, och appen ger råd om lagring, drickfönster,
mat och tillfälle – och påminner om du haft samma vin förut.

---

## 2. Viktig insikt om streckkoder

- Streckkoden (EAN-13/UPC) identifierar oftast **produkten, inte årgången**. Samma
  EAN används ofta år efter år.
- Därför: EAN → kandidat-vin → **användaren bekräftar årgång** (eller appen läser
  den från etiketten med kamera/OCR).
- Alla flaskor har inte en EAN som finns i någon databas (småproducenter,
  importerade privat). Fallback: **fotografera etiketten** och låt bild-AI
  identifiera vinet, eller sök manuellt.

Flöde för identifiering:

```
Skanna EAN ──► Egen cache/DB ──träff──► Bekräfta årgång ──► Klar
                   │ miss
                   ▼
           Externa källor (Systembolaget, Open Food Facts, UPC-tjänster)
                   │ miss / osäkert
                   ▼
           Etikettfoto ──► Vision-AI (OCR + tolkning) ──► Matcha ──► Bekräfta
                   │ miss
                   ▼
           Manuell sökning / manuell registrering
```

---

## 3. Datakällor och API:er

| Behov | Källa | Kommentar |
|---|---|---|
| EAN → produkt (Sverige) | **Systembolaget** sortiment | Bäst täckning för svenska användare. Det öppna API:et har stängts/begränsats – kontrollera aktuella villkor. Alternativ: periodiska sortimentsdumpar som byggs upp i egen databas. |
| EAN → produkt (globalt) | **Open Food Facts** (gratis, öppen data, ODbL) | Har en del viner med EAN, varierande kvalitet. Bra gratis fallback. |
| EAN → produkt | **UPCitemdb**, **Barcode Lookup**, **GS1 (Verified by GS1)** | Kommersiella/frigräns. GS1 ger tillverkardata men ofta tunn vininfo. |
| Viner, priser, betyg | **Wine-Searcher API** | Betalt. Kritikerbetyg (aggregerat), priser, producent, region. |
| Kritikerbetyg | **Global Wine Score** | Betalt API, aggregerar kritikerbetyg per årgång. |
| Community-recensioner | **Vivino** | Inget officiellt publikt API, skrapning bryter mot villkoren → **använd inte**. Länka gärna ut till vinet istället. |
| Egen källa | **CellarTracker** | Inget öppet API, men användare kan exportera sin egen källare (CSV) → import-funktion. |
| Egna recensioner | **Appens egna användare** | Långsiktigt den viktigaste källan: egna betyg och anteckningar. |
| Etikett-igenkänning | **Claude (vision)** / Google ML Kit text recognition | Läs producent, namn, årgång, region från foto. |
| Rådgivning (lagring, drickfönster, mat, tillfälle) | **Claude API** med strukturerad output | Genereras från vindata (druva, region, årgång, stil, alkohol, socker, syra) + ev. källdata. Cachas per vin+årgång. |
| Druv/region-grunddata | Egen kurerad tabell (+ Wikidata) | Ger stabila regler för drickfönster/lagring som AI:n kan luta sig mot. |

**Rekommendation för MVP:** Systembolaget-data (där det går) + Open Food Facts +
etikettfoto via Claude vision + egen databas som växer med varje registrering.
Lägg till betalda betygs-API:er (Wine-Searcher / Global Wine Score) när det finns
behov och budget.

---

## 4. Föreslagen teknikstack

| Del | Val | Varför |
|---|---|---|
| App | **React Native + Expo** (TypeScript) | iOS + Android från en kodbas, bra kamera/streckkodsstöd (`expo-camera`). |
| Backend | **Supabase** (Postgres, Auth, Storage, Edge Functions) | Snabb start, SQL-databas, inloggning, bildlagring, serverfunktioner för API-nycklar. |
| AI | **Claude API** (anropas endast från backend) | Etikett-OCR, sammanfattning av recensioner, råd om lagring/mat/drickfönster. |
| Offline | Lokal SQLite i appen (t.ex. `expo-sqlite`) | Källaren ska gå att bläddra i utan nät, synkas sen. |
| Notiser | Expo Notifications | "Dags att dricka"-påminnelser. |

Alla externa API-nycklar ligger i backend – appen pratar bara med egen backend.

---

## 5. Projektstruktur (monorepo)

```
trand-vine/
├── apps/
│   └── mobile/                 # Expo-appen
│       ├── app/                # Skärmar (expo-router)
│       │   ├── (tabs)/
│       │   │   ├── cellar.tsx      # Min källare
│       │   │   ├── scan.tsx        # Skanna
│       │   │   ├── history.tsx     # Historik / druckna
│       │   │   └── profile.tsx
│       │   ├── wine/[id].tsx       # Vin-detalj
│       │   └── bottle/[id].tsx     # Flask-detalj
│       ├── components/
│       ├── features/
│       │   ├── scanning/       # Streckkod + etikettfoto
│       │   ├── cellar/
│       │   ├── recommendations/
│       │   └── history/
│       └── lib/                # API-klient, offline-DB, hooks
├── backend/
│   └── supabase/
│       ├── migrations/         # SQL-schema
│       └── functions/          # Edge functions
│           ├── lookup-barcode/     # EAN → vin (cache + externa källor)
│           ├── identify-label/     # Foto → vin (vision-AI)
│           ├── fetch-reviews/      # Hämta/aggregera betyg
│           ├── recommend/          # Lagring, drickfönster, mat, tillfälle
│           └── drink-reminders/    # Schemalagd: notiser
├── packages/
│   ├── shared/                 # Delade typer (Wine, Bottle, ...) + zod-scheman
│   └── providers/              # Adaptrar per datakälla (systembolaget, off, ...)
└── docs/
```

`packages/providers` får ett gemensamt gränssnitt så källor kan läggas till/bytas:

```ts
interface WineProvider {
  name: string;
  lookupByBarcode(ean: string): Promise<WineCandidate[]>;
  search?(query: string): Promise<WineCandidate[]>;
  getReviews?(wineId: string, vintage?: number): Promise<Review[]>;
}
```

---

## 6. Datamodell (förenklad)

```
wines               – ett vin oberoende av årgång
  id, name, producer, country, region, appellation,
  color (röd/vit/rosé/mousserande/sött/starkvin),
  grapes[], style, abv, sugar, acidity, image_url

wine_barcodes       – EAN → vin (en flaska kan ha flera EAN, olika storlekar)
  ean, wine_id, bottle_size_ml, source

vintages            – vin + årgång (betyg och råd hör hit)
  id, wine_id, year

reviews             – betyg/recensioner från källor eller användare
  id, vintage_id, source, score, scale, text, author, url, fetched_at

recommendations     – AI/regel-genererade råd, cachade per årgång
  vintage_id, drink_from, drink_to, peak_from, peak_to,
  storage (temp, liggande, potential_years),
  food_pairings[], occasions[], serving_temp, decant_minutes,
  model_version, generated_at

bottles             – en fysisk flaska som användaren äger/ägt
  id, user_id, vintage_id, size_ml,
  acquisition_type (köp, gåva, vinprovning, arv, byte, annat),
  acquired_at, price, currency, store,
  gift_from, occasion_note,            -- vid gåva
  location (t.ex. "Källare, hylla 3"),
  status (i_lager, drucken, given_bort, trasig),
  consumed_at, consumed_with, consumed_food,
  rating, notes, photo_url

users
```

**Historik** blir då en enkel fråga: alla `bottles` för samma `wine_id`
(eller samma `vintage_id`) hos användaren, med betyg och anteckningar.

---

## 7. Funktioner

### MVP (version 1)
1. **Skanna streckkod** och identifiera vin (cache → externa källor).
2. **Etikettfoto som fallback** (Claude vision) + manuell sökning/registrering.
3. **Bekräfta årgång och storlek.**
4. **Ange anskaffning:** köp (pris, butik, datum), gåva (från vem, tillfälle),
   vinprovning, arv, byte, annat.
5. **"Du har haft detta vin förut!"** – visas direkt vid skanning, med tidigare
   betyg, anteckningar, när/med vem det dracks.
6. **Recensioner/betyg** – aggregerat från tillgängliga källor + egna.
7. **Råd per flaska:**
   - Lagring: temperatur, liggande/stående, lagringspotential.
   - Drickfönster: tidigast / topp / senast (med tidslinje).
   - Mat: konkreta rätter + varför.
   - Tillfälle/sällskap: vardag, middagsbjudning, fest, present, romantisk middag…
   - Servering: temperatur, dekantering, glas.
8. **Min källare:** lista, filter (färg, land, druva, drickfönster), plats.
9. **Markera som drucken:** datum, med vem, till vilken mat, betyg, anteckning.

### Version 2
- **Påminnelser:** "3 flaskor går in i sitt drickfönster", "drick före 2027".
- **Omvänd sökning:** "Vad ska jag dricka till lammstek ikväll?" → förslag ur
  egen källare.
- **Källarstatistik:** värde, antal, fördelning, vad som snart passerar topp.
- **Import** från CellarTracker/CSV, **export** till CSV.
- **Delade källare** (hushåll).
- **Gåvoregister:** vem har gett mig vad, vad har jag gett bort till vem.

### Senare
- Socialt: dela betyg med vänner.
- Inköpslista / önskelista med länk till Systembolaget.
- Smaksprofil som lär sig av dina betyg och anpassar rekommendationer.

---

## 8. Hur råden genereras

1. Samla fakta: druva, region, årgång, stil, alkohol, socker, syra, ev.
   kritikers drickfönster från källor.
2. Kör regelbaserad grund (t.ex. "lätt vardagsvitt: drick inom 1–2 år",
   "Barolo från bra årgång: 8–25 år").
3. Låt Claude förfina och formulera råd med **strukturerad JSON-output** enligt
   schemat i `recommendations`, med källhänvisning där det finns.
4. Cacha per `vintage_id` – samma vin/årgång behöver inte genereras igen.
5. Visa tydligt i appen vad som är källdata och vad som är AI-genererat råd.

---

## 9. Öppna frågor

- Endast Sverige först (Systembolaget-fokus) eller globalt från start?
- Budget för betalda API:er (Wine-Searcher, Global Wine Score)?
- Konto obligatoriskt, eller lokalt läge utan inloggning?
- Ska användarnas egna betyg delas mellan användare (community) från start?

## 10. Föreslagen ordning

1. Datamodell + Supabase-schema.
2. Expo-app med skanning → `lookup-barcode` (Open Food Facts + egen DB).
3. Registrera flaska med anskaffningstyp + historik-kontroll.
4. `identify-label` (etikettfoto) och `recommend` (Claude).
5. Källarvy, "markera som drucken", påminnelser.
