import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Loading, colors } from "../components/ui.tsx";
import { AuthProvider, useAuth } from "../lib/auth.tsx";
import { LocaleProvider, useT } from "../lib/i18n.tsx";

function RootStack() {
  const { session, loading, locale } = useAuth();
  if (loading) return <Loading />;
  return (
    <LocaleProvider locale={locale}>
      <Screens signedIn={!!session} />
    </LocaleProvider>
  );
}

function Screens({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.wine,
        contentStyle: { backgroundColor: colors.bg },
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
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <RootStack />
    </AuthProvider>
  );
}
