import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { View } from "react-native";
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

/** Mobile first: på bred skärm (webb på dator) visas appen som en mittcentrerad mobilkolumn. */
const MAX_WIDTH = 480;

function AppFrame({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", backgroundColor: colors.surfaceRaised }}>
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: MAX_WIDTH,
          backgroundColor: colors.background,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: colors.border,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppFrame>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </AppFrame>
    </ThemeProvider>
  );
}
