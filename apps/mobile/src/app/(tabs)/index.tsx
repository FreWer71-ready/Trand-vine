// Min källare: flaskor i lager, det som brådskar mest överst.

import { COLOR_LABELS, PHASE_LABELS, type WineColor } from "@trand-vine/core";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Body, Button, Card, Chips, ErrorText, Loading, PHASE_COLORS, Screen, colors } from "../../components/ui.tsx";
import { listBottles, type BottleRow } from "../../lib/api.ts";
import { sortByUrgency, wineTitle } from "../../lib/format.ts";
import { useLocale, useT } from "../../lib/i18n.tsx";

export default function Cellar() {
  const t = useT();
  const locale = useLocale();
  const [bottles, setBottles] = useState<BottleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<WineColor | "all">("all");

  useFocusEffect(
    useCallback(() => {
      listBottles(["in_cellar"]).then(setBottles, (e: Error) => setError(e.message));
    }, []),
  );

  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!bottles) return <Loading />;
  if (bottles.length === 0) {
    return (
      <Screen>
        <Body>{t("emptyCellar")}</Body>
        <Button title={t("scan")} onPress={() => router.navigate("/scan")} />
      </Screen>
    );
  }

  const present = [...new Set(bottles.map((b) => b.vintages.wines.color).filter((c): c is WineColor => !!c))];
  const shown = sortByUrgency(bottles).filter(({ bottle }) => color === "all" || bottle.vintages.wines.color === color);

  return (
    <Screen>
      {present.length > 1 && (
        <Chips
          value={color}
          onChange={setColor}
          options={[
            { value: "all" as const, label: t("all", { n: bottles.length }) },
            ...present.map((c) => ({ value: c, label: COLOR_LABELS[c][locale] })),
          ]}
        />
      )}
      {shown.map(({ bottle, phase, rec }) => (
        <Card key={bottle.id} onPress={() => router.push(`/bottle/${bottle.id}`)}>
          <Text style={{ fontSize: 16, fontWeight: "600" }}>{wineTitle(bottle.vintages)}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: PHASE_COLORS[phase], fontWeight: "500" }}>{PHASE_LABELS[phase][locale]}</Text>
            <Text style={{ color: colors.muted }}>{rec.drinkFrom}–{rec.drinkTo}</Text>
          </View>
          {bottle.location && <Text style={{ color: colors.muted }}>{bottle.location}</Text>}
        </Card>
      ))}
    </Screen>
  );
}
