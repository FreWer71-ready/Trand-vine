// Registrera en flaska: välj vin → årgång, storlek och hur flaskan anskaffades.

import {
  ACQUISITION_LABELS,
  COLOR_LABELS,
  extractVintage,
  toCanonicalEan,
  type AcquisitionType,
  type WineCandidate,
  type WineColor,
} from "@trand-vine/core";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Body, Button, Card, Chips, ErrorText, Field, Heading, Screen, Stepper, T, Title } from "../components/ui.tsx";
import {
  createBottle,
  createWine,
  ensureVintage,
  getWine,
  linkBarcode,
  searchExternal,
  searchWines,
  systembolagetOffers,
  wineHistory,
  type HistoryRow,
  type ScanResult,
  type SystembolagetOffer,
  type WineRow,
} from "../lib/api.ts";
import { isIsoDate, today } from "../lib/format.ts";
import { deviceCurrency, useLocale, useT } from "../lib/i18n.tsx";
import { loadLastChoices, saveLastChoices } from "../lib/prefs.ts";
import { getAddAgain, getPendingLabel, getPendingScan, type AddAgain, type LabelResult } from "../lib/scanStore.ts";

/**
 * Valt vin: antingen befintligt i registret (med Systembolagets pris m.m. om
 * vinet finns där) eller nytt från källa/manuellt.
 */
type Choice =
  | { kind: "existing"; wine: WineRow; offer?: SystembolagetOffer }
  | { kind: "new"; candidate: WineCandidate };

const SIZES = [375, 500, 750, 1500, 3000];
const COLORS: WineColor[] = ["red", "white", "rose", "sparkling", "dessert", "fortified"];
const ACQUISITIONS: AcquisitionType[] = ["purchase", "gift", "tasting", "inheritance", "trade", "other"];

export default function Register() {
  const t = useT();
  const [scan] = useState<ScanResult | null>(() => getPendingScan());
  // "Lägg till igen" från en flaska: vinet är redan valt.
  const [again] = useState<AddAgain | null>(() => getAddAgain());
  // Etikettfoto: förslag och årgång från texten på etiketten.
  const [label] = useState<LabelResult | null>(() => getPendingLabel());
  const [choice, setChoice] = useState<Choice | null>(() => (again ? { kind: "existing", wine: again.wine } : null));

  // Känt vin från streckkoden → hoppa direkt till detaljer.
  useEffect(() => {
    if (scan?.status === "known") {
      getWine(scan.wineId).then((wine) => setChoice({ kind: "existing", wine }), () => undefined);
    }
  }, [scan]);

  if (!choice) {
    return <ChooseWine scan={scan} label={label} onChoose={setChoice} />;
  }
  const preset = again && choice.kind === "existing" && choice.wine.id === again.wine.id ? again : null;
  return (
    <BottleDetails
      key={choice.kind === "existing" ? choice.wine.id : choice.candidate.name}
      scan={scan}
      choice={choice}
      preset={preset}
      labelVintage={label?.vintage ?? null}
      labelEan={label?.ean}
      onBack={scan?.status === "known" ? undefined : () => setChoice(null)}
      t={t}
    />
  );
}

function ChooseWine({ scan, label, onChoose }: { scan: ScanResult | null; label: LabelResult | null; onChoose: (c: Choice) => void }) {
  const t = useT();
  const locale = useLocale();
  // Med etikettfoto står den lästa texten i sökrutan, så att den går att justera.
  const [query, setQuery] = useState(label && !label.matches.length ? label.display : "");
  const [results, setResults] = useState<WineRow[]>([]);
  const [offers, setOffers] = useState<Map<string, SystembolagetOffer>>(new Map());
  const [external, setExternal] = useState<WineCandidate[]>([]);
  // Vilken sökning resultaten hör till, så att svar på gamla sökord ignoreras.
  const [searched, setSearched] = useState("");
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [name, setName] = useState("");
  const [producer, setProducer] = useState("");
  const [color, setColor] = useState<WineColor | null>(null);

  // Sök först i eget register; hittas för lite, fråga Open Food Facts.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setExternal([]);
      setSearched("");
      return;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      setSearching(true);
      const own = await searchWines(q).catch(() => []);
      if (cancelled) return;
      setResults(own);
      setOffers(await systembolagetOffers(own).catch(() => new Map()));
      if (cancelled) return;
      const more = own.length < 3 ? await searchExternal(q).catch(() => []) : [];
      if (cancelled) return;
      setExternal(more);
      setSearched(q);
      setSearching(false);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(id);
      setSearching(false);
    };
  }, [query]);

  const startManual = () => {
    setManual(true);
    setName(query.trim());
  };

  if (scan?.status === "known") return <Screen><Body>{t("lookingUp")}</Body></Screen>;

  const noHits =
    !searching && !manual && !!searched && searched === query.trim() && results.length === 0 && external.length === 0;
  const candidates = scan?.status === "candidates" ? scan.candidates : [];
  const registry = scan?.registryMatches ?? [];

  return (
    <Screen>
      <Title>{t("chooseWine")}</Title>
      {scan?.status === "not_found" && <Body muted>{t("notFound")}</Body>}
      {scan?.status === "invalid_barcode" && <Body muted>{t("invalidBarcode")}</Body>}

      {label && (
        <>
          <T variant="label">{t("fromLabel")}</T>
          {!label.matches.length && <Body muted>{t("labelNoMatch")}</Body>}
          {label.matches.map((w) => (
            <WineCard key={`label:${w.id}`} title={[w.producer, w.name].filter(Boolean).join(" – ")} subtitle={[w.region, w.country].filter(Boolean).join(", ")} onPress={() => onChoose({ kind: "existing", wine: w })} />
          ))}
        </>
      )}
      {registry.map((w) => (
        <WineCard key={w.id} title={[w.producer, w.name].filter(Boolean).join(" – ")} subtitle={[w.region, w.country].filter(Boolean).join(", ")} onPress={() => onChoose({ kind: "existing", wine: w })} />
      ))}
      {candidates.map((c) => (
        <WineCard
          key={`${c.source}:${c.sourceId}:${c.name}`}
          title={[c.producer, c.name].filter(Boolean).join(" – ")}
          subtitle={t("newWineFromSource", { source: c.source })}
          onPress={() => onChoose({ kind: "new", candidate: c })}
        />
      ))}

      <Field label={t("search")} placeholder={t("searchPlaceholder")} value={query} onChangeText={setQuery} autoCorrect={false} />
      {searching && <T variant="muted">{t("searching")}</T>}
      {results.map((w) => {
        const o = offers.get(w.id);
        const sb = o && [t("systembolagetNr", { nr: o.short_number }), o.vintage, o.price !== null ? `${o.price} kr` : null].filter(Boolean).join(" · ");
        return (
          <WineCard
            key={w.id}
            title={[w.producer, w.name].filter(Boolean).join(" – ")}
            subtitle={[[w.region, w.country].filter(Boolean).join(", "), sb].filter(Boolean).join("\n")}
            onPress={() => onChoose({ kind: "existing", wine: w, offer: o })}
          />
        );
      })}
      {external.length > 0 && <T variant="label">{t("fromOpenFoodFacts")}</T>}
      {external.map((c) => (
        <WineCard
          key={`ext:${c.sourceId}`}
          title={[c.producer, c.name].filter(Boolean).join(" – ")}
          subtitle={[c.country, c.bottleSizeMl ? `${c.bottleSizeMl / 10} cl` : null].filter(Boolean).join(" · ")}
          onPress={() => onChoose({ kind: "new", candidate: c })}
        />
      ))}
      {noHits && (
        <Card highlight>
          <T variant="body">{t("noHits", { q: searched })}</T>
          <Button title={t("addAsNew", { q: searched })} onPress={startManual} />
        </Card>
      )}

      {manual ? (
        <Card>
          <Field label={t("wineName")} value={name} onChangeText={setName} />
          <Field label={t("producer")} value={producer} onChangeText={setProducer} />
          <Chips label={t("color")} value={color} onChange={setColor} options={COLORS.map((c) => ({ value: c, label: COLOR_LABELS[c][locale] }))} />
          <Button
            title={t("next")}
            disabled={!name.trim()}
            onPress={() =>
              onChoose({
                kind: "new",
                candidate: {
                  source: "user",
                  sourceId: "",
                  name: name.trim(),
                  producer: producer.trim() || undefined,
                  color: color ?? undefined,
                  vintage: extractVintage(name),
                },
              })
            }
          />
        </Card>
      ) : (
        !noHits && <Button title={t("addManually")} variant="secondary" onPress={startManual} />
      )}
    </Screen>
  );
}

function WineCard({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Card onPress={onPress}>
      <T variant="cardTitle">{title}</T>
      {!!subtitle && <T variant="muted">{subtitle}</T>}
    </Card>
  );
}

function sizeLabel(ml: number, locale: string) {
  return (ml >= 1000 ? `${ml / 1000} l` : `${ml / 10} cl`).replace(".", locale === "sv" ? "," : ".");
}

function BottleDetails({
  scan,
  choice,
  preset,
  labelVintage,
  labelEan,
  onBack,
  t,
}: {
  scan: ScanResult | null;
  choice: Choice;
  preset: AddAgain | null;
  labelVintage: number | null;
  /** Okänd streckkod som skannades före etikettfotot. */
  labelEan?: string;
  onBack?: () => void;
  t: ReturnType<typeof useT>;
}) {
  const locale = useLocale();
  const candidate = choice.kind === "new" ? choice.candidate : null;
  const offer = choice.kind === "existing" ? choice.offer : undefined;
  const title =
    choice.kind === "existing"
      ? [choice.wine.producer, choice.wine.name].filter(Boolean).join(" – ")
      : [candidate!.producer, candidate!.name].filter(Boolean).join(" – ");

  const [history, setHistory] = useState<HistoryRow[]>([]);
  // Förifyllt i första hand från flaskan som läggs till igen, sedan från
  // etiketten, Systembolaget och sist från streckkodskällan.
  // Årgång tryckt på etiketten går före Systembolagets (som kan vara en annan årgång).
  const startYear = preset ? preset.year : (labelVintage ?? offer?.vintage ?? candidate?.vintage ?? null);
  const startSize = [preset?.sizeMl, offer?.volume_ml, candidate?.bottleSizeMl].find((s) => s && SIZES.includes(s)) ?? 750;
  const [year, setYear] = useState(startYear ? String(startYear) : "");
  const [nonVintage, setNonVintage] = useState(!!preset && preset.year === null);
  const [size, setSize] = useState(startSize);
  const [quantity, setQuantity] = useState(1);
  const [acq, setAcq] = useState<AcquisitionType>("purchase");
  const [date, setDate] = useState(today());
  const [price, setPrice] = useState(offer?.price != null ? String(offer.price) : "");
  const [currency, setCurrency] = useState(offer ? "SEK" : deviceCurrency());
  const [store, setStore] = useState(offer ? "Systembolaget" : "");
  const [giftFrom, setGiftFrom] = useState("");
  const [occasion, setOccasion] = useState("");
  const [location, setLocation] = useState(preset?.location ?? "");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Senaste valen (köp/gåva, butik, valuta, plats). Ett vin från Systembolaget
  // behåller sin butik och sitt pris.
  useEffect(() => {
    let cancelled = false;
    loadLastChoices().then((last) => {
      if (cancelled) return;
      if (last.location && !preset?.location) setLocation(last.location);
      if (offer) return;
      if (last.acquisition) setAcq(last.acquisition);
      if (last.store) setStore(last.store);
      if (last.currency) setCurrency(last.currency);
    });
    return () => {
      cancelled = true;
    };
  }, [offer, preset]);

  // "Du har haft detta vin förut" – endast för vin som redan finns i registret.
  useEffect(() => {
    if (choice.kind === "existing") wineHistory(choice.wine.id).then(setHistory, () => setHistory([]));
  }, [choice]);

  const yearNum = Number(year);
  const yearValid = nonVintage || (/^\d{4}$/.test(year) && yearNum >= 1800 && yearNum <= new Date().getFullYear());
  const priceNum = price ? Number(price.replace(",", ".")) : null;
  const valid = yearValid && isIsoDate(date) && (priceNum === null || priceNum >= 0);
  // Fälten under "Fler uppgifter" visas alltid om något där är fel.
  const showMore = more || !isIsoDate(date) || !(priceNum === null || priceNum >= 0);
  const summary = [
    sizeLabel(size, locale),
    date === today() ? t("today") : date,
    acq === "purchase" && priceNum !== null ? `${price} ${currency}` : null,
    acq === "purchase" ? store.trim() || null : null,
    location.trim() || null,
  ].filter(Boolean).join(" · ");

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const wine = choice.kind === "existing" ? choice.wine : await createWine(choice.candidate);
      const ean =
        scan && scan.status !== "invalid_barcode" && "ean" in scan
          ? scan.ean
          : labelEan ?? toCanonicalEan(candidate?.ean ?? "");
      if (ean) await linkBarcode(ean, wine.id, candidate?.source ?? "user", size);
      const vintageId = await ensureVintage(wine.id, nonVintage ? null : yearNum);
      const id = await createBottle({
        vintage_id: vintageId,
        size_ml: size,
        quantity,
        acquisition_type: acq,
        acquired_at: date,
        price: acq === "purchase" ? priceNum : null,
        currency: acq === "purchase" && priceNum !== null ? currency.toUpperCase().slice(0, 3) : null,
        store: acq === "purchase" ? store.trim() || null : null,
        gift_from: acq === "gift" ? giftFrom.trim() || null : null,
        occasion_note: occasion.trim() || null,
        location: location.trim() || null,
      });
      await saveLastChoices({ acquisition: acq, store: store.trim(), currency: currency.toUpperCase().slice(0, 3), location: location.trim() });
      router.replace(`/bottle/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{title}</Title>
      {onBack && <Button title={t("changeWine")} variant="secondary" onPress={onBack} />}

      {history.length > 0 && (
        <Card highlight>
          <T variant="cardTitle">{t("hadBefore")}</T>
          <Body>{history.length === 1 ? t("hadBeforeOne") : t("hadBeforeCount", { n: history.length })}</Body>
          {history.slice(0, 3).map((h) => (
            <Body key={h.bottle_id} muted>
              {h.year ?? "NV"} · {ACQUISITION_LABELS[h.acquisition_type][locale]}
              {h.gift_from ? ` (${h.gift_from})` : ""}
              {h.rating ? ` · ${"★".repeat(h.rating)}` : ""}
              {h.notes ? ` · ${h.notes}` : ""}
            </Body>
          ))}
        </Card>
      )}

      <Chips label={t("vintage")} value={nonVintage ? 1 : 0} onChange={(v) => setNonVintage(v === 1)} options={[{ value: 0, label: t("vintage") }, { value: 1, label: t("nonVintage") }]} />
      {!nonVintage && <Field label={t("vintage")} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} placeholder="2018" />}
      {!yearValid && <Body muted>{t("vintageHelp")}</Body>}

      <Stepper label={t("quantity")} value={quantity} onChange={setQuantity} />

      <Heading>{t("howAcquired")}</Heading>
      <Chips value={acq} onChange={setAcq} options={ACQUISITIONS.map((a) => ({ value: a, label: ACQUISITION_LABELS[a][locale] }))} />
      {acq === "gift" && <Field label={t("giftFrom")} value={giftFrom} onChangeText={setGiftFrom} />}

      {showMore ? (
        <>
          <Chips label={t("size")} value={size} onChange={setSize} options={SIZES.map((s) => ({ value: s, label: sizeLabel(s, locale) }))} />
          <Field label={t("date")} value={date} onChangeText={setDate} maxLength={10} />
          {acq === "purchase" && (
            <>
              <Field label={quantity > 1 ? t("pricePerBottle") : t("price")} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
              <Field label={t("currency")} value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={3} />
              <Field label={t("store")} value={store} onChangeText={setStore} />
            </>
          )}
          <Field label={acq === "gift" ? t("occasion") : t("note")} value={occasion} onChangeText={setOccasion} />
          <Field label={t("location")} value={location} onChangeText={setLocation} />
        </>
      ) : (
        <Card onPress={() => setMore(true)}>
          <T variant="muted">{summary}</T>
          <T variant="strong">{t("moreDetails")}</T>
        </Card>
      )}

      <ErrorText>{error ?? (!yearValid ? t("needYear") : !isIsoDate(date) ? t("needDate") : !valid ? t("needPrice") : null)}</ErrorText>
      <Button title={quantity > 1 ? t("addBottles", { n: quantity }) : t("addBottle")} onPress={save} loading={busy} disabled={!valid} />
    </Screen>
  );
}
