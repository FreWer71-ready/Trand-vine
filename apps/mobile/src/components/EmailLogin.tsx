// E-post + engångskod. Används för att spara källaren (anonym → konto) och för
// att logga in på ett befintligt konto från en ny enhet. Befintliga konton med
// lösenord kan logga in med lösenord i stället.
//
// admin: adminingången (/admin) – loggar in på ett befintligt konto utan att
// flytta någon källare, och kommer ihåg e-postadressen (localStorage admin_epost).

import { useState } from "react";
import { Platform, Pressable } from "react-native";
import {
  sendEmailCode,
  sendLoginCode,
  signInWithPassword,
  verifyEmailCode,
  WrongPasswordError,
  type EmailFlow,
} from "../lib/account.ts";
import { useAuth } from "../lib/auth.tsx";
import { useT } from "../lib/i18n.tsx";
import { useTheme } from "../lib/theme.tsx";
import { Body, Button, ErrorText, Field, T } from "./ui.tsx";

const ADMIN_EMAIL_KEY = "admin_epost";

function rememberedEmail(admin: boolean): string {
  if (!admin || Platform.OS !== "web") return "";
  try {
    return globalThis.localStorage?.getItem(ADMIN_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberEmail(admin: boolean, email: string) {
  if (!admin || Platform.OS !== "web") return;
  try {
    globalThis.localStorage?.setItem(ADMIN_EMAIL_KEY, email);
  } catch {
    // Privat läge: adressen fylls inte i nästa gång.
  }
}

export function EmailLogin({ intro, admin = false }: { intro: string; admin?: boolean }) {
  const t = useT();
  const theme = useTheme();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState(() => rememberedEmail(admin));
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [flow, setFlow] = useState<EmailFlow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  async function run(step: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await step();
    } catch (e) {
      setError(e instanceof WrongPasswordError ? t("wrongPassword") : e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  const switchMode = (password: boolean) => {
    setUsePassword(password);
    setFlow(null);
    setCode("");
    setPassword("");
    setError(null);
  };

  if (usePassword) {
    return (
      <>
        <Body muted>{intro}</Body>
        <Field
          label={t("email")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="username"
          keyboardType="email-address"
          inputMode="email"
        />
        <Field
          label={t("password")}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          secureTextEntry
        />
        <ErrorText>{error}</ErrorText>
        <Button
          title={t("signInPassword")}
          loading={busy}
          disabled={!validEmail || !password}
          onPress={() => run(async () => {
            rememberEmail(admin, email.trim());
            await signInWithPassword(email.trim(), password, !admin);
            await refreshProfile();
          })}
        />
        <Button title={t("useOneTimeCode")} variant="secondary" onPress={() => switchMode(false)} />
      </>
    );
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
        <>
          <Button
            title={t("sendCode")}
            loading={busy}
            disabled={!validEmail}
            onPress={() => run(async () => {
              rememberEmail(admin, email.trim());
              setFlow(await (admin ? sendLoginCode(email.trim()) : sendEmailCode(email.trim())));
            })}
          />
          <Pressable accessibilityRole="link" onPress={() => switchMode(true)} style={{ alignSelf: "center", padding: 8 }}>
            <T variant="body" color={theme.colors.primary}>{t("passwordInstead")}</T>
          </Pressable>
        </>
      )}
    </>
  );
}
