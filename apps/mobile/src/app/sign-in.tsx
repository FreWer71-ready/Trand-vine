// Inloggning med engångskod via e-post – inget lösenord, inga andra uppgifter.
// Supabase-mallen "Magic Link" måste innehålla {{ .Token }} (se README).

import { useState } from "react";
import { Body, Button, ErrorText, Field, Screen, Title } from "../components/ui.tsx";
import { useT } from "../lib/i18n.tsx";
import { supabase } from "../lib/supabase.ts";

export default function SignIn() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError(error.message);
    // Vid lyckad inloggning byter layouten automatiskt till appen.
  }

  return (
    <Screen>
      <Title>{t("appName")}</Title>
      <Body muted>{t("signInIntro")}</Body>
      <Field
        label={t("email")}
        value={email}
        onChangeText={setEmail}
        editable={!sent}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      {sent && (
        <Field
          label={t("code")}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={10}
        />
      )}
      <ErrorText>{error}</ErrorText>
      {sent ? (
        <>
          <Button title={t("verify")} onPress={verify} loading={busy} disabled={code.trim().length < 6} />
          <Button title={t("changeEmail")} variant="secondary" onPress={() => { setSent(false); setCode(""); }} />
        </>
      ) : (
        <Button title={t("sendCode")} onPress={sendCode} loading={busy} disabled={!email.includes("@")} />
      )}
    </Screen>
  );
}
