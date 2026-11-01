// Egen ingång för admin på webben: /admin. Utan konto visas en inloggning
// (engångskod eller lösenord) – ingen inbjudningsspärr och ingen anonym session.
// Behörigheten avgörs i databasen (is_admin(), private.admin_emails) och i
// funktionen admin-users; klienten styr bara vad som visas.

import { useAuth } from "../lib/auth.tsx";
import { useT } from "../lib/i18n.tsx";
import { supabase } from "../lib/supabase.ts";
import { EmailLogin } from "./EmailLogin.tsx";
import { Body, Button, Card, Screen, Title } from "./ui.tsx";

export function AdminLogin() {
  const t = useT();
  return (
    <Screen>
      <Title>{t("adminLoginTitle")}</Title>
      <Card>
        <EmailLogin intro={t("adminLoginIntro")} admin />
      </Card>
    </Screen>
  );
}

export function NoAdminAccess() {
  const t = useT();
  const { session } = useAuth();
  return (
    <Screen>
      <Title>{t("noAdminAccess")}</Title>
      <Body>{t("noAdminAccessText", { email: session?.user.email ?? "" })}</Body>
      <Button title={t("toApp")} onPress={() => globalThis.location?.assign("/")} />
      <Button title={t("otherAccount")} variant="secondary" onPress={() => void supabase.auth.signOut()} />
    </Screen>
  );
}
