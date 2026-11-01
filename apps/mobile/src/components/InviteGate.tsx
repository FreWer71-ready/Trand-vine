// Som festkoden i Fredrik55: appen kräver en inbjudningskod innan man kan
// börja. Har man redan ett konto loggar man in med e-post i stället.

import { useState } from "react";
import { Platform } from "react-native";

/** Kod från länken (?kod=…) som admin delar, så att gästen slipper skriva den. */
function codeFromLink(): string {
  if (Platform.OS !== "web") return "";
  try {
    return (new URLSearchParams(globalThis.location?.search ?? "").get("kod") ?? "").toUpperCase();
  } catch {
    return "";
  }
}
import { redeemInvite } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useT } from "../lib/i18n.tsx";
import { EmailLogin } from "./EmailLogin.tsx";
import { Body, Button, Card, ErrorText, Field, Heading, Screen, Title } from "./ui.tsx";
import { TrandLogo } from "./TrandLogo.tsx";

export function InviteGate() {
  const t = useT();
  const { refreshProfile } = useAuth();
  const [code, setCode] = useState(codeFromLink);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await redeemInvite(code);
      if (res === "ok") await refreshProfile();
      else setError(t(`invite_${res}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TrandLogo variant="lockup" height={28} />
      <Title>{t("appName")}</Title>
      <Body>{t("inviteIntro")}</Body>
      <Field
        label={t("inviteCode")}
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={32}
        onSubmitEditing={() => code.trim() && void submit()}
      />
      <ErrorText>{error}</ErrorText>
      <Button title={t("inviteContinue")} onPress={submit} loading={busy} disabled={code.trim().length < 4} />
      <Body muted>{t("inviteNoCode")}</Body>

      <Heading>{t("haveAccount")}</Heading>
      {login ? (
        <Card>
          <EmailLogin intro={t("signInIntro")} />
        </Card>
      ) : (
        <Button title={t("signInEmail")} variant="secondary" onPress={() => setLogin(true)} />
      )}
    </Screen>
  );
}
