import { useEffect, useState } from "react";
import { Body, Button, Chips, ErrorText, Field, Screen } from "../../components/ui.tsx";
import { updateProfile } from "../../lib/api.ts";
import { useAuth } from "../../lib/auth.tsx";
import { LOGIN_ENABLED } from "../../lib/config.ts";
import { useT } from "../../lib/i18n.tsx";
import { supabase } from "../../lib/supabase.ts";

export default function Profile() {
  const t = useT();
  const { session, profile, refreshProfile } = useAuth();
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
      {LOGIN_ENABLED && <Body muted>{session?.user.email}</Body>}
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
      {/* Utloggning av ett anonymt konto skulle tappa källaren – bara med inloggning påslagen. */}
      {LOGIN_ENABLED && <Button title={t("signOut")} variant="secondary" onPress={() => supabase.auth.signOut()} />}
    </Screen>
  );
}
