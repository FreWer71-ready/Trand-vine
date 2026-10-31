// Min källare: flaskor i lager. Standard: grupperat på vintyp och druva.
// Kan filtreras (typ, druva, land, region, dricktid) och sorteras.

import { COLOR_LABELS, PHASE_LABELS, type WineColor } from "@trand-vine/core";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { Body, Button, Card, Chips, ErrorText, Loading, Screen, T, phaseColor } from "../../components/ui.tsx";
import { currentPrices, listBottles, type BottleRow, type CurrentPrice } from "../../lib/api.ts";
import {
  DEFAULT_DIR,
  NO_FILTERS,
  SORT_KEYS,
  activeFilterCount,
  applyFilters,
  buildRows,
  filterOptions,
  mergeIdentical,
  toItems,
  type Filters,
  type SortDir,
  type SortKey,
  type StatusFilter,
} from "../../lib/cellar.ts";
import { formatPrice, wineTitle } from "../../lib/format.ts";
import { openManualAdd } from "../../lib/scanStore.ts";
import { useLocale, useT, type StringKey } from "../../lib/i18n.tsx";
import { useTheme } from "../../lib/theme.tsx";

const SORT_LABEL: Record<SortKey, StringKey> = {
  group: "sortGroup",
  urgency: "sortUrgency",
  country: "sortCountry",
  region: "sortRegion",
  grape: "sortGrape",
  added: "sortAdded",
  purchased: "sortPurchased",
  price: "sortPrice",
};

export default function Cellar() {
  const t = useT();
  const locale = useLocale();
  const theme = useTheme();
  const [bottles, setBottles] = useState<BottleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortKey>("group");
  const [dir, setDir] = useState<SortDir>("asc");
  const [offers, setOffers] = useState<Map<string, CurrentPrice>>(new Map());
  const items = useMemo(() => (bottles ? toItems(mergeIdentical(bottles), offers) : []), [bottles, offers]);
  const options = useMemo(() => filterOptions(items, locale), [items, locale]);
  const rows = useMemo(
    () =>
      buildRows(applyFilters(items, filters), sort, dir, {
        locale,
        unknownType: t("unknownType"),
        unknownGrape: t("unknownGrape"),
        unknownCountry: t("unknownCountry"),
        unknownRegion: t("unknownRegion"),
      }),
    [items, filters, sort, dir, locale, t],
  );
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const any = { value: "all", label: t("filterAny") };
  const asOptions = (xs: string[]) => [any, ...xs.map((x) => ({ value: x, label: x }))];
  const activeFilters = activeFilterCount(filters);

  useFocusEffect(
    useCallback(() => {
      listBottles(["in_cellar"]).then(
        (list) => {
          setBottles(list);
          // Systembolagets pris hämtas efteråt, så att listan visas direkt.
          currentPrices(list).then(setOffers, () => undefined);
        },
        (e: Error) => setError(e.message),
      );
    }, []),
  );

  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!bottles) return <Loading />;
  if (bottles.length === 0) {
    return (
      <Screen>
        <Body>{t("emptyCellar")}</Body>
        <Button title={t("scan")} onPress={() => router.navigate("/scan")} />
        <Button title={t("addManual")} variant="secondary" onPress={openManualAdd} />
      </Screen>
    );
  }

  const total = bottles.reduce((sum, b) => sum + b.quantity, 0);

  return (
    <Screen>
      <Button title={t("addBottleShort")} variant="secondary" onPress={openManualAdd} />

      <Chips
        label={t("sortBy")}
        value={sort}
        onChange={(k) => {
          setSort(k);
          setDir(DEFAULT_DIR[k]);
        }}
        options={SORT_KEYS.map((k) => ({ value: k, label: t(SORT_LABEL[k]) }))}
      />
      {sort !== "group" && (
        <Chips
          value={dir}
          onChange={setDir}
          options={[
            { value: "asc" as const, label: t("sortAsc") },
            { value: "desc" as const, label: t("sortDesc") },
          ]}
        />
      )}

      <Button
        title={activeFilters ? t("filtersActive", { n: activeFilters }) : t("filters")}
        variant="secondary"
        onPress={() => setShowFilters((v) => !v)}
      />
      {showFilters && (
        <Card>
          {options.colors.length > 1 && (
            <Chips
              label={t("filterType")}
              value={filters.color}
              onChange={(v) => setFilter("color", v)}
              options={[{ value: "all" as const, label: t("filterAny") }, ...options.colors.map((c: WineColor) => ({ value: c, label: COLOR_LABELS[c][locale] }))]}
            />
          )}
          <Chips
            label={t("filterStatus")}
            value={filters.status}
            onChange={(v) => setFilter("status", v)}
            options={[
              { value: "all" as StatusFilter, label: t("filterAny") },
              { value: "ready" as StatusFilter, label: t("statusReady") },
              { value: "keep" as StatusFilter, label: t("statusKeep") },
            ]}
          />
          {options.grapes.length > 1 && <Chips label={t("filterGrape")} value={filters.grape} onChange={(v) => setFilter("grape", v)} options={asOptions(options.grapes)} />}
          {options.countries.length > 1 && <Chips label={t("filterCountry")} value={filters.country} onChange={(v) => setFilter("country", v)} options={asOptions(options.countries)} />}
          {options.regions.length > 1 && <Chips label={t("filterRegion")} value={filters.region} onChange={(v) => setFilter("region", v)} options={asOptions(options.regions)} />}
          {activeFilters > 0 && <Button title={t("clearFilters")} variant="secondary" onPress={() => setFilters(NO_FILTERS)} />}
        </Card>
      )}

      {rows.length === 0 && <Body muted>{t("noMatches")}</Body>}
      {rows.map((row) => {
        if (row.kind === "heading") return <T key={row.key} variant="heading">{`${row.title} · ${row.count}`}</T>;
        if (row.kind === "subheading") return <T key={row.key} variant="label">{`${row.title} · ${row.count}`}</T>;
        const { bottle, phase, rec, offer } = row.item;
        return (
          <Card key={row.key} onPress={() => router.push(`/bottle/${bottle.id}`)}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: theme.space.md }}>
              <View style={{ flex: 1 }}>
                <T variant="cardTitle">{wineTitle(bottle.vintages)}</T>
              </View>
              {bottle.quantity > 1 && (
                <View
                  accessibilityLabel={t("bottlesCount", { n: bottle.quantity })}
                  style={{
                    minWidth: 44,
                    alignItems: "center",
                    backgroundColor: theme.colors.primary,
                    borderRadius: theme.radius.chip,
                    paddingHorizontal: theme.space.md,
                    paddingVertical: theme.space.xs,
                  }}
                >
                  <T variant="heading" color={theme.colors.onPrimary} style={{ marginTop: 0, paddingBottom: 0, borderBottomWidth: 0 }}>
                    {`×${bottle.quantity}`}
                  </T>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <T variant="strong" color={phaseColor(theme, phase)}>{PHASE_LABELS[phase][locale]}</T>
              <T variant="data" color={theme.colors.textMuted}>{rec.drinkFrom}–{rec.drinkTo}</T>
            </View>
            {bottle.price !== null && (
              <T variant="muted">
                {t("priceEach", {
                  price:
                    bottle.priceMax != null && bottle.priceMax !== bottle.price
                      ? `${formatPrice(bottle.price, bottle.currency, locale)}–${formatPrice(bottle.priceMax, bottle.currency, locale)}`
                      : formatPrice(bottle.price, bottle.currency, locale),
                })}
              </T>
            )}
            {offer && (
              <T variant="muted">
                {offer.probability >= 1
                  ? t("systembolagetPrice", { price: formatPrice(offer.price, "SEK", locale) })
                  : t("systembolagetLikelyPrice", { price: formatPrice(offer.price, "SEK", locale), pct: Math.round(offer.probability * 100) })}
              </T>
            )}
            {bottle.location && <T variant="muted">{bottle.location}</T>}
          </Card>
        );
      })}
      <T variant="muted">{t("all", { n: total })}</T>
    </Screen>
  );
}
