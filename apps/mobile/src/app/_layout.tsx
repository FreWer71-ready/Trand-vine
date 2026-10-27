import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Body, ErrorText, Loading, Screen, Title } from "../components/ui.tsx";
import { AuthProvider, useAuth } from "../lib/auth.tsx";
import { LOGIN_ENABLED } from "../lib/config.ts";
import { LocaleProvider, useT } from "../lib/i18n.tsx";
import { ThemeProvider, useTheme, useThemeFonts } from "../lib/theme.tsx";

function RootStack() {
  const { session, loading, error, locale } = useAuth();
  const fontsReady = useThemeFonts();
  if (loading || !fontsReady) return <Loading />;
  return (
    <LocaleProvider locale={locale}>
      {!session && !LOGIN_ENABLED ? <StartError error={error} /> : <Screens signedIn={!!session} />}
    </LocaleProvider>
  );
}

/** Visas om den anonyma inloggningen misslyckas när inloggningssidan är avstängd. */
function StartError({ error }: { error: string | null }) {
  const t = useT();
  return (
    <Screen>
      <Title>{t("appName")}</Title>
      <Body>{t("startFailed")}</Body>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

function Screens({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const theme = useTheme();
  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surfaceRaised },
          headerTintColor: theme.colors.navActive,
          headerTitleStyle: { fontFamily: theme.fonts.heading.native, color: theme.colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ title: t("addBottle"), presentation: "modal" }} />
          <Stack.Screen name="bottle/[id]" options={{ title: "" }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn && LOGIN_ENABLED}>
          <Stack.Screen name="sign-in" options={{ title: t("signInTitle") }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </ThemeProvider>
  );
}
