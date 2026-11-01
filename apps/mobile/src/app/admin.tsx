// Admin (som /admin i Fredrik55): inbjudningskoder och användare.
// Visas bara för admin; databasen nekar alla andra (is_admin()).

import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Body, Button, Card, Chips, ErrorText, Field, Heading, Loading, Screen, T } from "../components/ui.tsx";
import {
  adminCreateCode,
  adminDeleteUser,
  adminOverview,
  adminSetCodeActive,
  adminSetUserAccess,
  type AdminOverview,
} from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useT } from "../lib/i18n.tsx";

const MAX_USES = [1, 5, 20, 0]; // 0 = obegränsat

/** Länk som fyller i koden åt gästen (som QR-länken med ?kod= i Fredrik55). */
const inviteLink = (code: string) =>
  `${Platform.OS === "web" ? globalThis.location?.origin : "https://wine.trand.se"}/?kod=${encodeURIComponent(code)}`;

/** Lägger texten i urklipp: webbläsarens urklipp på webben, expo-clipboard i appen. */
async function copyText(text: string) {
  if (Platform.OS === "web") await globalThis.navigator.clipboard.writeText(text);
  else await Clipboard.setStringAsync(text);
}

export default function Admin() {
  const t = useT();
  const { admin, session } = useAuth();
  // Borttagning kräver två tryck: först "Ta bort", sedan "Bekräfta".
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  // Koden vars meddelande nyss kopierades (kort bekräftelse).
  const [copied, setCopied] = useState<string | null>(null);

  /** Färdigt inbjudningsmeddelande för sms, Messenger eller mejl. */
  async function copyInvite(code: string) {
    setError(null);
    try {
      await copyText(t("inviteMessage", { link: inviteLink(code), code }));
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    }
  }

  const copyButton = (code: string) => (
    <>
      <Button title={t("copyMessage")} variant="secondary" onPress={() => void copyInvite(code)} />
      {copied === code && <Body>{t("messageCopied")}</Body>}
    </>
  );

  const load = useCallback(async () => {
    try {
      setData(await adminOverview());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    }
  }, []);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  async function act(step: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await step();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (!admin) return <Screen><Body>{t("adminOnly")}</Body></Screen>;
  if (!data) return error ? <Screen><ErrorText>{error}</ErrorText></Screen> : <Loading />;

  const s = data.stats;
  return (
    <Screen>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          [t("adminUsers"), s.users],
          [t("adminApproved"), s.approved],
          [t("adminBottles"), s.bottles],
          [t("adminWines"), s.wines],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <T variant="label">{String(label)}</T>
            <T variant="title">{String(value)}</T>
          </Card>
        ))}
      </View>

      <Heading>{t("adminNewCode")}</Heading>
      <Field label={t("adminCodeOptional")} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={32} />
      <Field label={t("adminNote")} value={note} onChangeText={setNote} placeholder={t("adminNotePlaceholder")} />
      <Chips
        label={t("adminMaxUses")}
        value={maxUses}
        onChange={setMaxUses}
        options={MAX_USES.map((n) => ({ value: n, label: n === 0 ? t("adminUnlimited") : String(n) }))}
      />
      <Button
        title={t("adminCreate")}
        loading={busy}
        disabled={!!code && !/^[A-Z0-9-]{4,32}$/.test(code)}
        onPress={() => act(async () => {
          setCreated(await adminCreateCode({ code, note, maxUses: maxUses || null }));
          setCode("");
          setNote("");
        })}
      />
      {created && (
        <Card highlight>
          <T variant="label">{t("adminCreated")}</T>
          <T variant="title">{created}</T>
          <Body muted>{inviteLink(created)}</Body>
          {copyButton(created)}
        </Card>
      )}
      <ErrorText>{error}</ErrorText>

      <Heading>{t("adminCodes")}</Heading>
      {data.codes.length === 0 && <Body muted>{t("adminNoCodes")}</Body>}
      {data.codes.map((c) => (
        <Card key={c.code}>
          <T variant="cardTitle">{c.code}{c.active ? "" : ` · ${t("adminInactive")}`}</T>
          {!!c.note && <Body>{c.note}</Body>}
          <Body muted>
            {t("adminUsed", { n: c.uses })}
            {c.max_uses ? ` / ${c.max_uses}` : ` · ${t("adminUnlimited")}`} · {c.created_at.slice(0, 10)}
          </Body>
          <Body muted>{inviteLink(c.code)}</Body>
          <Button
            title={c.active ? t("adminDeactivate") : t("adminActivate")}
            variant="secondary"
            onPress={() => act(() => adminSetCodeActive(c.code, !c.active))}
          />
          {copyButton(c.code)}
        </Card>
      ))}

      <Heading>{t("adminUsers")}</Heading>
      {data.users.map((u) => (
        <Card key={u.id}>
          <T variant="cardTitle">{u.email ?? `${u.name} (${t("adminAnonymous")})`}</T>
          <Body muted>
            {u.approved_at ? `${t("adminCode")} ${u.invite_code ?? "–"}` : t("adminNoAccess")} · {t("adminBottlesCount", { n: u.bottles })} · {u.created_at.slice(0, 10)}
          </Body>
          <Button
            title={u.approved_at ? t("adminRevoke") : t("adminGrant")}
            variant="secondary"
            onPress={() => act(() => adminSetUserAccess(u.id, !u.approved_at))}
          />
          {u.id !== session?.user.id &&
            (confirmDelete === u.id ? (
              <>
                <Body>{t("adminDeleteWarning", { n: u.bottles })}</Body>
                <Button
                  title={t("adminDeleteConfirm")}
                  loading={busy}
                  onPress={() => act(async () => {
                    await adminDeleteUser(u.id);
                    setConfirmDelete(null);
                  })}
                />
                <Button title={t("cancel")} variant="secondary" onPress={() => setConfirmDelete(null)} />
              </>
            ) : (
              <Button title={t("adminDelete")} variant="secondary" onPress={() => setConfirmDelete(u.id)} />
            ))}
        </Card>
      ))}
    </Screen>
  );
}
