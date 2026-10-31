// Skanna streckkod → slå upp vinet → gå vidare till registrering.

import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router, useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, ErrorText, Field, Loading, Screen, T } from "../../components/ui.tsx";
import { LabelError, lookupBarcode, readLabel } from "../../lib/api.ts";
import { cameraRemembered, rememberCamera } from "../../lib/cameraConsent.ts";
import { shrinkForUpload } from "../../lib/shrinkImage.ts";
import { useT } from "../../lib/i18n.tsx";
import { openManualAdd, setPendingLabel, setPendingScan } from "../../lib/scanStore.ts";
import { useTheme } from "../../lib/theme.tsx";

export default function Scan() {
  const t = useT();
  const focused = useIsFocused();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  // Webb: har användaren sagt ja förut startar vi kameran direkt (se cameraConsent).
  const [webAllowed, setWebAllowed] = useState(cameraRemembered);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  // Kameran rapporterar samma kod många gånger per sekund.
  const handling = useRef(false);
  const camera = useRef<CameraView>(null);
  const [reading, setReading] = useState(false);
  // Etikettläge: stor ram som täcker kamerabilden, ingen streckkodsskanning.
  const [labelMode, setLabelMode] = useState(false);
  // Lampa: alltid i telefonappen; på webben bara där kameran stöder det
  // (oftast Android/Chrome – Safari på iPhone saknar stöd).
  const [torch, setTorch] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(Platform.OS !== "web");
  // Släck när man lämnar fliken, så att lampan inte är tänd nästa gång.
  useEffect(() => {
    if (!focused) setTorch(false);
  }, [focused]);

  // Etikettfoto: när streckkoden saknas eller inte ger träff.
  async function photoLabel() {
    if (!camera.current || reading) return;
    setReading(true);
    setError(null);
    try {
      // Telefonapp: lägre kvalitet räcker för text. Webb: krymps i shrinkForUpload.
      const pic = await camera.current.takePictureAsync({ base64: true, quality: Platform.OS === "web" ? 0.9 : 0.4 });
      const image = await shrinkForUpload(pic?.uri, pic?.base64);
      if (!image) throw new LabelError("failed");
      const result = await readLabel(image);
      setPendingLabel({ display: result.display, vintage: result.vintage, matches: result.matches });
      router.push("/register");
    } catch (e) {
      const code = e instanceof LabelError ? e.code : "failed";
      setError(t(code === "not_configured" ? "labelNotConfigured" : code === "quota" ? "labelQuota" : code === "timeout" ? "labelTimeout" : "labelFailed"));
    } finally {
      setReading(false);
    }
  }

  async function lookUp(code: string) {
    if (handling.current) return;
    handling.current = true;
    setBusy(true);
    setError(null);
    try {
      setPendingScan(await lookupBarcode(code));
      setTyped("");
      router.push("/register");
    } catch {
      setError(t("lookupFailed"));
    } finally {
      setBusy(false);
      // Ge användaren en stund att flytta kameran innan nästa skanning.
      setTimeout(() => (handling.current = false), 1500);
    }
  }

  const onScanned = ({ data }: BarcodeScanningResult) => void lookUp(data);

  // Alternativ när kameran inte går att använda: skriv streckkoden eller lägg till för hand.
  const fallback = (
    <>
      <Field
        label={t("typeBarcode")}
        value={typed}
        onChangeText={(v) => setTyped(v.replace(/[^\d\s-]/g, ""))}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={20}
        onSubmitEditing={() => typed.trim() && void lookUp(typed)}
      />
      <Button title={t("lookUpBarcode")} onPress={() => void lookUp(typed)} loading={busy} disabled={typed.replace(/\D/g, "").length < 8} />
      <ErrorText>{error}</ErrorText>
      <T variant="muted">{t("orAddManually")}</T>
      <Button title={t("addManual")} variant="secondary" onPress={openManualAdd} />
    </>
  );

  const web = Platform.OS === "web";
  if (!permission) return <Loading />;
  const blocked = permission.status === "denied" && !permission.canAskAgain;
  if (!permission.granted && !(web && webAllowed && !blocked)) {
    // På webben startar knappen kameran direkt, så att webbläsaren bara frågar en gång.
    const allow = web
      ? () => {
          rememberCamera(true);
          setWebAllowed(true);
        }
      : requestPermission;
    return (
      <Screen>
        <Body>{blocked || (web && permission.status === "denied") ? t("cameraBlocked") : t("cameraPermission")}</Body>
        <Button title={t("allowCamera")} onPress={allow} />
        {fallback}
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {focused && (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "itf14"] }}
          onBarcodeScanned={busy || labelMode ? undefined : onScanned}
          enableTorch={torch}
          onCameraReady={() => {
            rememberCamera(true);
            if (Platform.OS === "web") setTorchAvailable(webTorchSupported());
          }}
          onMountError={() => {
            // Nekad eller ingen kamera: glöm ja:et och visa alternativen.
            rememberCamera(false);
            setWebAllowed(false);
          }}
        />
      )}
      {torchAvailable && (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: torch }}
          accessibilityLabel={t("torch")}
          onPress={() => setTorch((on) => !on)}
          style={[styles.torch, torch && styles.torchOn]}
        >
          <Text style={[styles.torchText, torch && { color: "#000" }]}>{torch ? t("torchOff") : t("torchOn")}</Text>
        </Pressable>
      )}
      <View style={[styles.overlay, labelMode && styles.overlayLabel]}>
        <View style={labelMode ? styles.labelFrame : styles.frame} />
        <Text style={[styles.hint, { fontFamily: theme.fonts.heading.native }]}>
          {reading ? t("readingLabel") : busy ? t("lookingUp") : labelMode ? t("pointAtLabel") : t("pointAtBarcode")}
        </Text>
        {(busy || reading) && <ActivityIndicator color="#fff" />}
      </View>
      <View style={[styles.bottom, { backgroundColor: theme.colors.background }]}>
        {labelMode ? (
          <>
            <Button title={t("photoLabel")} onPress={() => void photoLabel()} loading={reading} />
            <Button title={t("scanBarcodeInstead")} variant="secondary" onPress={() => setLabelMode(false)} disabled={reading} />
          </>
        ) : (
          <>
            <Button title={t("readLabel")} variant="secondary" onPress={() => { setError(null); setLabelMode(true); }} disabled={busy} />
            {fallback}
          </>
        )}
        {labelMode && <ErrorText>{error}</ErrorText>}
      </View>
    </View>
  );
}

/** Webb: har kamerans videospår stöd för lampa (torch)? */
function webTorchSupported(): boolean {
  try {
    const video = globalThis.document?.querySelector("video");
    const track = (video?.srcObject as MediaStream | null)?.getVideoTracks()[0];
    const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
    return caps?.torch === true;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  torch: {
    position: "absolute", top: 12, right: 12, zIndex: 2, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "#fff",
  },
  torchOn: { backgroundColor: "#ffd54a", borderColor: "#ffd54a" },
  torchText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  frame: { width: "80%", height: 140, borderWidth: 3, borderColor: "#fff", borderRadius: 16 },
  // Etikett: ramen fyller kamerabilden så att hela etiketten kommer med.
  overlayLabel: { paddingHorizontal: 16, paddingVertical: 16 },
  labelFrame: { width: "100%", flex: 1, borderWidth: 3, borderColor: "#fff", borderRadius: 16 },
  hint: { color: "#fff", fontSize: 17, textShadowColor: "#000", textShadowRadius: 4 },
  bottom: { padding: 16, gap: 8 },
});
