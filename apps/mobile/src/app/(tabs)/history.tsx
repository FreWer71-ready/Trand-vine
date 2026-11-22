// Druckna och bortgivna flaskor, senaste först, eller som topplista över druckna viner.

import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { Body, Card, Chips, ErrorText, Grid, Loading, Screen, Stars, T } from "../../components/ui.tsx";
import { listBottles, type BottleRow } from "../../lib/api.ts";
import { wineTitle } from "../../lib/format.ts";
import { useT } from "../../lib/i18n.tsx";
import { useTheme } from "../../lib/theme.tsx";
import { topList } from "../../lib/topList.ts";

type View_ = "latest" | "top";

export default function History() {
  const t = useT();
  const theme = useTheme();
  const [bottles, setBottles] = useState<BottleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View_>("latest");
  const top = useMemo(() => (bottles ? topList(bottles) : []), [bottles]);

  useFocusEffect(
    useCallback(() => {
      listBottles(["consumed", "given_away"]).then(setBottles, (e: Error) => setError(e.message));
    }, []),
  );

  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!bottles) return <Loading />;
  if (bottles.length === 0) return <Screen><Body>{t("emptyHistory")}</Body></Screen>;

  return (
    <Screen wide>
      <Chips<View_>
        value={view}
        onChange={setView}
        options={[{ value: "latest", label: t("historyLatest") }, { value: "top", label: t("historyTop") }]}
      />
      {view === "latest" ? (
        <Grid>{bottles.map((b) => (
          <Card key={b.id} onPress={() => router.push(`/bottle/${b.id}`)}>
            <T variant="cardTitle">{wineTitle(b.vintages)}</T>
            <T variant="muted">
              {b.status === "consumed" ? t("consumed") : t("givenAway")}
              {b.consumed_at ? ` · ${b.consumed_at}` : ""}
              {b.consumed_with ? ` · ${b.consumed_with}` : ""}
            </T>
            {b.rating && <Stars value={b.rating} />}
          </Card>
        ))}</Grid>
      ) : top.length === 0 ? (
        <Body>{t("emptyHistory")}</Body>
      ) : (
        <Grid>{top.map((e, i) => (
          <Card key={e.vintage.id} onPress={() => router.push(`/bottle/${e.latestBottleId}`)}>
            <View style={{ flexDirection: "row", gap: theme.space.md, alignItems: "flex-start" }}>
              <T variant="cardTitle" color={i < 3 && e.rating !== null ? theme.colors.primary : theme.colors.textMuted} style={{ minWidth: 28 }}>
                {i + 1}.
              </T>
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="cardTitle">{wineTitle(e.vintage)}</T>
                {e.rating !== null ? (
                  <Stars value={e.rating} />
                ) : (
                  <T variant="muted">{t("topNoRating")}</T>
                )}
                <T variant="muted">
                  {t("topDrunk", { n: e.count })}
                  {e.lastDrunk ? ` · ${t("topLast", { date: e.lastDrunk })}` : ""}
                  {e.rating !== null && e.ratedCount < e.count ? ` · ${t("topRatedOf", { rated: e.ratedCount, n: e.count })}` : ""}
                </T>
              </View>
            </View>
          </Card>
        ))}</Grid>
      )}
    </Screen>
  );
}
