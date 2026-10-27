// Skanna streckkod → slå upp vinet → gå vidare till registrering.

import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router, useIsFocused } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Body, Button, ErrorText, Loading, Screen } from "../../components/ui.tsx";
import { lookupBarcode } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";
import { setPendingScan } from "../../lib/scanStore.ts";
import { useTheme } from "../../lib/theme.tsx";

export default function Scan() {
  const t = useT();
  const focused = useIsFocused();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kameran rapporterar samma kod många gånger per sekund.
  const handling = useRef(false);

  async function onScanned({ data }: BarcodeScanningResult) {
    if (handling.current) return;
    handling.current = true;
    setBusy(true);
    setError(null);
    try {
      setPendingScan(await lookupBarcode(data));
      router.push("/register");
    } catch {
      setError(t("lookupFailed"));
    } finally {
      setBusy(false);
      // Ge användaren en stund att flytta kameran innan nästa skanning.
      setTimeout(() => (handling.current = false), 1500);
    }
  }

  function searchInstead() {
    setPendingScan(null);
    router.push("/register");
  }

  if (!permission) return <Loading />;
  if (!permission.granted) {
    return (
      <Screen>
        <Body>{t("cameraPermission")}</Body>
        <Button title={t("allowCamera")} onPress={requestPermission} />
        <Button title={t("searchInstead")} variant="secondary" onPress={searchInstead} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {focused && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "itf14"] }}
          onBarcodeScanned={busy ? undefined : onScanned}
        />
      )}
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={[styles.hint, { fontFamily: theme.fonts.heading.native }]}>{busy ? t("lookingUp") : t("pointAtBarcode")}</Text>
        {busy && <ActivityIndicator color="#fff" />}
      </View>
      <View style={[styles.bottom, { backgroundColor: theme.colors.background }]}>
        <ErrorText>{error}</ErrorText>
        <Button title={t("searchInstead")} variant="secondary" onPress={searchInstead} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  frame: { width: "80%", height: 140, borderWidth: 3, borderColor: "#fff", borderRadius: 16 },
  hint: { color: "#fff", fontSize: 17, textShadowColor: "#000", textShadowRadius: 4 },
  bottom: { padding: 16, gap: 8 },
});
