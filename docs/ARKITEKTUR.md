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
           Externa källor (Open Food Facts, UPCitemdb)
                   │ miss / osäkert
                   ▼
           Etikettfoto ──► OCR på telefonen ──► Sök i LWIN/X-Wines ──► Bekräfta
                   │ miss
                   ▼
           Manuell sökning / manuell registrering
```

---

## 3. Datakällor och API:er

**Beslut:** global app, endast gratis källor i första läget.

### Gratis källor (används i v1)

| Behov | Källa | Kommentar |
|---|---|---|
| EAN → produkt (globalt) | **Open Food Facts** | Gratis, öppen data (ODbL), öppet API utan nyckel. Har en del viner med EAN, varierande kvalitet. Första externa uppslag. |
| EAN → produkt | **UPCitemdb** (gratisnivå) | 100 anrop/dag utan registrering (varav 20 sökningar). Används sparsamt som andra uppslag; resultat cachas i egen DB. |
| Vinregister (namn, producent, region, färg) | **LWIN-databasen** (Liv-ex) | Gratis, Creative Commons, 200 000+ viner. Laddas ned som XLSX och importeras i egen DB. Ger stabil vin-identitet (LWIN-kod) att matcha mot – men innehåller inga EAN. |
| Vindata + community-betyg (startdata) | **X-Wines** (öppet forskningsdataset) | ~100 000 viner från 62 länder, druvor, alkohol, årgångar, medelbetyg och 21 milj. betyg (2012–2021). Importeras som startdata så appen har betyg från dag ett. Kontrollera licensvillkor före kommersiell användning. |
| Druvor, regioner, producenter | **Wikidata** | Gratis, öppen data. Kompletterar druv-/regionsfakta. |
| Etikett-igenkänning (OCR) | **Google ML Kit Text Recognition** | Gratis, körs på telefonen. Läser text från etiketten → fritextsökning mot egen DB. |
| Betyg | **Appens användare** | Medelbetyg (1–5) per vin och årgång från alla användare. Långsiktigt den viktigaste källan. |
| Råd (lagring, drickfönster, mat, tillfälle) | **Egen regelmotor** | Regler per färg/druva/region/stil + årgång. Gratis och förutsägbar. |
| Import | **CellarTracker CSV-export** | Användaren exporterar sin egen källare och importerar. |

### Använd inte

- **Vivino** – inget publikt API, skrapning bryter mot villkoren. Länka gärna ut.

### Senare (kostar, när det finns behov/budget)

| Källa | Vad det tillför |
|---|---|
| **Claude API** (vision + text) | Bättre etikettigenkänning från foto och mer nyanserade, välformulerade råd. Låg kostnad per anrop och resultaten cachas per vin/årgång, men inte gratis. |
| **Wine-Searcher API**, **Global Wine Score** | Kritikerbetyg och priser. |
| **UPCitemdb** betald nivå / **GS1** | Fler EAN-träffar. |

### Strategi: egen databas som växer

Varje gång en användare skannar en EAN som inte fanns och sedan bekräftar vilket
vin det är, sparas kopplingen `EAN → vin` i egen databas. Nästa användare får
träff direkt. Med en global användarbas blir den egna databasen snabbt den bästa
källan – helt gratis.

---

## 4. Föreslagen teknikstack

| Del | Val | Varför |
|---|---|---|
| App | **React Native + Expo** (TypeScript) | iOS + Android från en kodbas, bra kamera/streckkodsstöd (`expo-camera`). |
| Backend | **Supabase** (Postgres, Auth, Storage, Edge Functions) | Snabb start, SQL-databas, inloggning, bildlagring, serverfunktioner för API-nycklar. |
| OCR | **Google ML Kit** (på telefonen) | Gratis etikettläsning. |
| Råd | Egen regelmotor i backend | Gratis. Claude API kan läggas till senare för bättre etikettigenkänning och råd. |
| Inloggning | Supabase Auth (Apple, Google, e-post med magisk länk) | Enkelt, endast visningsnamn. |
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
│           ├── identify-label/     # OCR-text → vin (sök i egen DB)
│           ├── fetch-reviews/      # Hämta/aggregera betyg
│           ├── recommend/          # Lagring, drickfönster, mat, tillfälle
│           └── drink-reminders/    # Schemalagd: notiser
├── packages/
│   ├── shared/                 # Delade typer (Wine, Bottle, ...) + zod-scheman
│   └── providers/              # Adaptrar per datakälla (openfoodfacts, upcitemdb, lwin, xwines)
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
  grapes[], style, abv, sugar, acidity, image_url,
  lwin (LWIN-kod), xwines_id

wine_barcodes       – EAN → vin (en flaska kan ha flera EAN, olika storlekar)
  ean, wine_id, bottle_size_ml, source

vintages            – vin + årgång (betyg och råd hör hit)
  id, wine_id, year,
  avg_rating, rating_count      -- community-medelbetyg (1–5), uppdateras vid nytt betyg

reviews             – betyg/recensioner från källor eller användare
  id, vintage_id, source, score, scale, text, author, url, fetched_at

recommendations     – regel-genererade råd (senare ev. AI), cachade per årgång
  vintage_id, drink_from, drink_to, peak_from, peak_to,
  storage (temp, liggande, potential_years),
  food_pairings[], occasions[], serving_temp, decant_minutes,
  rules_version, generated_at

bottles             – en fysisk flaska som användaren äger/ägt
  id, user_id, vintage_id, size_ml,
  acquisition_type (köp, gåva, vinprovning, arv, byte, annat),
  acquired_at, price, currency, store,
  gift_from, occasion_note,            -- vid gåva
  location (t.ex. "Källare, hylla 3"),
  status (i_lager, drucken, given_bort, trasig),
  consumed_at, consumed_with, consumed_food,
  rating, notes, photo_url

users               – id, display_name, auth_provider, locale
```

**Historik** blir då en enkel fråga: alla `bottles` för samma `wine_id`
(eller samma `vintage_id`) hos användaren, med betyg och anteckningar.

---

## 7. Funktioner

### MVP (version 1)
1. **Skanna streckkod** och identifiera vin (cache → externa källor).
2. **Etikettfoto som fallback** (OCR på telefonen → sök i LWIN/X-Wines) + manuell sökning/registrering.
   Bekräftad koppling `EAN → vin` sparas så nästa användare får träff direkt.
3. **Bekräfta årgång och storlek.**
4. **Ange anskaffning:** köp (pris, butik, datum), gåva (från vem, tillfälle),
   vinprovning, arv, byte, annat.
5. **"Du har haft detta vin förut!"** – visas direkt vid skanning, med tidigare
   betyg, anteckningar, när/med vem det dracks.
6. **Betyg:** community-medelbetyg (1–5) + antal betyg, startdata från X-Wines.
   Ditt eget betyg räknas in i medelvärdet; anteckningar är privata.
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
- Inköpslista / önskelista med länk till lokala butiker (t.ex. Systembolaget i Sverige).
- Smaksprofil som lär sig av dina betyg och anpassar rekommendationer.

---

## 8. Hur råden genereras

1. Samla fakta: druva, region, årgång, stil, alkohol, socker, syra, ev.
   kritikers drickfönster från källor.
2. Kör regelbaserad grund (t.ex. "lätt vardagsvitt: drick inom 1–2 år",
   "Barolo från bra årgång: 8–25 år").
3. Översätt resultatet till texter (svenska/engelska) enligt schemat i
   `recommendations`. Senare kan Claude API förfina råden (betald).
4. Cacha per `vintage_id` – samma vin/årgång behöver inte genereras igen.
5. Visa tydligt i appen vad som är källdata och vad som är genererat råd.

---

## 9. Beslut

| Fråga | Beslut |
|---|---|
| Marknad | **Hela världen** från start. Appen på svenska + engelska (i18n från dag ett). |
| Betalda API:er | **Nej** i första läget – endast gratis källor (se avsnitt 3). |
| Konto | **Ja, obligatoriskt men enkelt:** logga in med Apple, Google eller e-post (magisk länk). Endast visningsnamn krävs, inga andra uppgifter. |
| Community-betyg | **Ja.** Andras betyg visas som **medelbetyg** (1–5) + antal betyg per vin och årgång. Egna anteckningar är privata. |

## 10. Föreslagen ordning

1. Datamodell + Supabase-schema + inloggning. Importera LWIN och X-Wines.
2. Expo-app med skanning → `lookup-barcode` (Open Food Facts + egen DB).
3. Registrera flaska med anskaffningstyp + historik-kontroll.
4. `identify-label` (OCR + sökning), regelmotorn `recommend`, community-betyg.
5. Källarvy, "markera som drucken", påminnelser.
