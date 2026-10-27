import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Loading } from "../components/ui.tsx";
import { AuthProvider, useAuth } from "../lib/auth.tsx";
import { LocaleProvider, useT } from "../lib/i18n.tsx";
import { ThemeProvider, useTheme, useThemeFonts } from "../lib/theme.tsx";

function RootStack() {
  const { session, loading, locale } = useAuth();
  const fontsReady = useThemeFonts();
  if (loading || !fontsReady) return <Loading />;
  return (
    <LocaleProvider locale={locale}>
      <Screens signedIn={!!session} />
    </LocaleProvider>
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
        <Stack.Protected guard={!signedIn}>
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
