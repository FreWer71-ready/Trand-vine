// Flaskdetalj: råd (drickfönster, lagring, servering, mat, tillfälle),
// community-betyg, din historik med vinet och "markera som drucken".

import {
  ACQUISITION_LABELS,
  FOOD_LABELS,
  OCCASION_LABELS,
  PHASE_LABELS,
  drinkPhase,
} from "@trand-vine/core";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import {
  Body,
  Button,
  Card,
  ErrorText,
  Field,
  Heading,
  Loading,
  Screen,
  Stars,
  Tags,
  T,
  Title,
  phaseColor,
} from "../../components/ui.tsx";
import {
  getBottle,
  takeBottle,
  wineHistory,
  wineRating,
  type BottleRow,
  type HistoryRow,
} from "../../lib/api.ts";
import { isIsoDate, recommendationFor, today, wineTitle } from "../../lib/format.ts";
import { useLocale, useT } from "../../lib/i18n.tsx";
import { useTheme } from "../../lib/theme.tsx";

export default function BottleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const locale = useLocale();
  const theme = useTheme();
  const [bottle, setBottle] = useState<BottleRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [wineAvg, setWineAvg] = useState<{ avg_rating: number; rating_count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consuming, setConsuming] = useState(false);

  const load = useCallback(async () => {
    try {
      const b = await getBottle(id);
      setBottle(b);
      const [h, r] = await Promise.all([wineHistory(b.vintages.wine_id), wineRating(b.vintages.wine_id)]);
      setHistory(h.filter((x) => x.bottle_id !== b.id));
      setWineAvg(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!bottle) return <Loading />;

  const wine = bottle.vintages.wines;
  const rec = recommendationFor(bottle);
  const phase = drinkPhase(rec);
  const inCellar = bottle.status === "in_cellar";
  // Årgångens betyg om det finns, annars vinets betyg över alla årgångar.
  const rating = bottle.vintages.rating_count > 0
    ? { avg: bottle.vintages.avg_rating, n: bottle.vintages.rating_count }
    : wineAvg ? { avg: wineAvg.avg_rating, n: wineAvg.rating_count } : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: bottle.vintages.year ? String(bottle.vintages.year) : "NV" }} />
      <Title>{wineTitle(bottle.vintages)}</Title>
      {inCellar && bottle.quantity > 1 && <T variant="strong">{t("bottlesLeft", { n: bottle.quantity })}</T>}
      <Body muted>
        {[wine.region, wine.country].filter(Boolean).join(", ")}
        {wine.grapes.length ? ` · ${wine.grapes.join(", ")}` : ""}
        {wine.abv ? ` · ${wine.abv} %` : ""}
      </Body>

      <Card>
        <T variant="label">{t("community")}</T>
        {rating?.avg ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Stars value={rating.avg} />
            <T variant="data">{rating.avg.toFixed(1)}</T>
            <T variant="muted">{t("ratingsCount", { n: rating.n })}</T>
          </View>
        ) : (
          <Body muted>{t("noRatings")}</Body>
        )}
      </Card>

      <Card>
        <T variant="label">{t("drinkWindow")}</T>
        <T variant="title" color={phaseColor(theme, phase)}>{PHASE_LABELS[phase][locale]}</T>
        <T variant="data">{rec.drinkFrom}–{rec.drinkTo} · {t("peak")} {rec.peakFrom}–{rec.peakTo}</T>
      </Card>

      <Heading>{t("storage")}</Heading>
      <Body>
        {t("storageText", {
          min: rec.storage.tempC[0],
          max: rec.storage.tempC[1],
          position: t(rec.storage.position === "lying" ? "lying" : "standing"),
          years: rec.storage.potentialYears,
        })}
      </Body>

      <Heading>{t("serving")}</Heading>
      <Body>
        {t("servingText", { min: rec.servingTempC[0], max: rec.servingTempC[1] })}
        {rec.decantMinutes > 0 ? ` · ${t("decant", { min: rec.decantMinutes })}` : ""}
      </Body>

      <Heading>{t("food")}</Heading>
      <Tags items={rec.food.map((f) => FOOD_LABELS[f][locale])} />

      <Heading>{t("occasions")}</Heading>
      <Tags items={rec.occasions.map((o) => OCCASION_LABELS[o][locale])} />
      <Body muted>{t("adviceDisclaimer")}</Body>

      <Heading>{t("acquired")}</Heading>
      <Body>
        {ACQUISITION_LABELS[bottle.acquisition_type][locale]}
        {bottle.acquired_at ? ` · ${bottle.acquired_at}` : ""}
        {bottle.gift_from ? ` · ${bottle.gift_from}` : ""}
        {bottle.price !== null ? ` · ${bottle.price} ${bottle.currency ?? ""}` : ""}
        {bottle.store ? ` · ${bottle.store}` : ""}
      </Body>
      {bottle.occasion_note && <Body muted>{bottle.occasion_note}</Body>}

      {!inCellar && (
        <Card>
          <T variant="cardTitle">
            {bottle.status === "consumed" ? t("consumed") : t("givenAway")}
            {bottle.consumed_at ? ` · ${bottle.consumed_at}` : ""}
          </T>
          {bottle.consumed_with && <Body>{t("consumedWith")} {bottle.consumed_with}</Body>}
          {bottle.consumed_food && <Body>{t("consumedFood")} {bottle.consumed_food}</Body>}
          {bottle.rating && <Stars value={bottle.rating} />}
          {bottle.notes && <Body muted>{bottle.notes}</Body>}
        </Card>
      )}

      {history.length > 0 && (
        <>
          <Heading>{t("yourHistory")}</Heading>
          {history.map((h) => (
            <Card key={h.bottle_id}>
              <T variant="cardTitle">
                {h.year ?? "NV"} · {ACQUISITION_LABELS[h.acquisition_type][locale]}
                {h.gift_from ? ` (${h.gift_from})` : ""}
              </T>
              {h.consumed_at && <Body muted>{h.consumed_at}{h.consumed_with ? ` · ${h.consumed_with}` : ""}{h.consumed_food ? ` · ${h.consumed_food}` : ""}</Body>}
              {h.rating && <Stars value={h.rating} />}
              {h.notes && <Body muted>{h.notes}</Body>}
            </Card>
          ))}
        </>
      )}

      {inCellar && !consuming && (
        <>
          <Button title={t("markConsumed")} onPress={() => setConsuming(true)} />
          <Button
            title={t("markGivenAway")}
            variant="secondary"
            onPress={async () => {
              await takeBottle(bottle.id, { status: "given_away", consumed_at: today() });
              await load();
            }}
          />
        </>
      )}
      {consuming && (
        <ConsumeForm
          onCancel={() => setConsuming(false)}
          onSave={async (patch) => {
            // Med fler flaskor kvar ligger posten kvar i källaren med ett mindre antal.
            await takeBottle(bottle.id, { status: "consumed", ...patch });
            setConsuming(false);
            await load();
          }}
        />
      )}
    </Screen>
  );
}

function ConsumeForm({
  onSave,
  onCancel,
}: {
  onSave: (p: { consumed_at: string; consumed_with: string | null; consumed_food: string | null; rating: number | null; notes: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useT();
  const [date, setDate] = useState(today());
  const [withWhom, setWithWhom] = useState("");
  const [food, setFood] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <Field label={t("date")} value={date} onChangeText={setDate} maxLength={10} />
      <Field label={t("consumedWith")} value={withWhom} onChangeText={setWithWhom} />
      <Field label={t("consumedFood")} value={food} onChangeText={setFood} />
      <T variant="label">{t("yourRating")}</T>
      <Stars value={rating} onChange={setRating} />
      <Field label={t("notes")} value={notes} onChangeText={setNotes} multiline />
      <ErrorText>{error}</ErrorText>
      <Button
        title={t("save")}
        loading={busy}
        disabled={!isIsoDate(date)}
        onPress={async () => {
          setBusy(true);
          try {
            await onSave({
              consumed_at: date,
              consumed_with: withWhom.trim() || null,
              consumed_food: food.trim() || null,
              rating,
              notes: notes.trim() || null,
            });
          } catch (e) {
            setError(e instanceof Error ? e.message : t("error"));
            setBusy(false);
          }
        }}
      />
      <Button title={t("cancel")} variant="secondary" onPress={onCancel} />
    </Card>
  );
}
