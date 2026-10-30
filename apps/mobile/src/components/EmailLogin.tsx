// E-post + engångskod. Används för att spara källaren (anonym → konto) och för
// att logga in på ett befintligt konto från en ny enhet.

import { useState } from "react";
import { sendEmailCode, verifyEmailCode, type EmailFlow } from "../lib/account.ts";
import { useAuth } from "../lib/auth.tsx";
import { useT } from "../lib/i18n.tsx";
import { Body, Button, ErrorText, Field } from "./ui.tsx";

export function EmailLogin({ intro }: { intro: string }) {
  const t = useT();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [flow, setFlow] = useState<EmailFlow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(step: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await step();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Body muted>{flow ? t("codeSent", { email: email.trim() }) : intro}</Body>
      <Field
        label={t("email")}
        value={email}
        onChangeText={setEmail}
        editable={!flow}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      {flow && (
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
      {flow ? (
        <>
          <Button
            title={t("verify")}
            loading={busy}
            disabled={code.trim().length < 6}
            onPress={() => run(async () => {
              await verifyEmailCode(email.trim(), code.trim(), flow);
              await refreshProfile();
            })}
          />
          <Button title={t("changeEmail")} variant="secondary" onPress={() => { setFlow(null); setCode(""); }} />
        </>
      ) : (
        <Button
          title={t("sendCode")}
          loading={busy}
          disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}
          onPress={() => run(async () => setFlow(await sendEmailCode(email.trim())))}
        />
      )}
    </>
  );
}
