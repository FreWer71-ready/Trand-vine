// Druckna och bortgivna flaskor, senaste först.

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Body, Card, ErrorText, Loading, Screen, Stars, T } from "../../components/ui.tsx";
import { listBottles, type BottleRow } from "../../lib/api.ts";
import { wineTitle } from "../../lib/format.ts";
import { useT } from "../../lib/i18n.tsx";

export default function History() {
  const t = useT();
  const [bottles, setBottles] = useState<BottleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      listBottles(["consumed", "given_away"]).then(setBottles, (e: Error) => setError(e.message));
    }, []),
  );

  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!bottles) return <Loading />;
  if (bottles.length === 0) return <Screen><Body>{t("emptyHistory")}</Body></Screen>;

  return (
    <Screen>
      {bottles.map((b) => (
        <Card key={b.id} onPress={() => router.push(`/bottle/${b.id}`)}>
          <T variant="cardTitle">{wineTitle(b.vintages)}</T>
          <T variant="muted">
            {b.status === "consumed" ? t("consumed") : t("givenAway")}
            {b.consumed_at ? ` · ${b.consumed_at}` : ""}
            {b.consumed_with ? ` · ${b.consumed_with}` : ""}
          </T>
          {b.rating && <Stars value={b.rating} />}
        </Card>
      ))}
    </Screen>
  );
}
