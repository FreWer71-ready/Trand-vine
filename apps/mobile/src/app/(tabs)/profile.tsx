import { useEffect, useState } from "react";
import { router } from "expo-router";
import { EmailLogin } from "../../components/EmailLogin.tsx";
import { TrandLogo } from "../../components/TrandLogo.tsx";
import { View } from "react-native";
import { Body, Button, Card, Chips, ErrorText, Field, Heading, Screen } from "../../components/ui.tsx";
import { signOut } from "../../lib/account.ts";
import { updateProfile } from "../../lib/api.ts";
import { useAuth } from "../../lib/auth.tsx";
import { useT } from "../../lib/i18n.tsx";

export default function Profile() {
  const t = useT();
  const { session, profile, admin, refreshProfile } = useAuth();
  const anonymous = session?.user.is_anonymous ?? true;
  const [name, setName] = useState(profile?.display_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setName(profile?.display_name ?? ""), [profile?.display_name]);

  async function save(patch: Parameters<typeof updateProfile>[0]) {
    setBusy(true);
    setError(null);
    try {
      await updateProfile(patch);
      await refreshProfile();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Field label={t("displayName")} value={name} onChangeText={setName} maxLength={50} />
      <Button
        title={t("save")}
        onPress={() => save({ display_name: name.trim() })}
        loading={busy}
        disabled={!name.trim() || name.trim() === profile?.display_name}
      />
      <Chips
        label={t("language")}
        value={profile?.locale ?? null}
        onChange={(locale) => save({ locale })}
        options={[
          { value: "sv" as const, label: "Svenska" },
          { value: "en" as const, label: "English" },
        ]}
      />
      <ErrorText>{error}</ErrorText>

      <Heading>{t("account")}</Heading>
      {anonymous ? (
        // Anonym: källaren finns bara på den här enheten tills man sparar den med e-post.
        <Card highlight>
          <EmailLogin intro={t("saveCellarIntro")} />
        </Card>
      ) : (
        <>
          <Body>{t("signedInAs", { email: session?.user.email ?? "" })}</Body>
          {/* Utloggning: källaren finns kvar på kontot; appen startar som ny anonym användare. */}
          <Button title={t("signOut")} variant="secondary" onPress={() => void signOut()} />
        </>
      )}
      {admin && <Button title={t("admin")} variant="secondary" onPress={() => router.push("/admin")} />}
      <View style={{ alignItems: "center", marginTop: 24, opacity: 0.85 }}>
        <TrandLogo variant="lockup" height={24} />
      </View>
    </Screen>
  );
}
