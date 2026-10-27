import { Tabs } from "expo-router/tabs";
import { Text, type ColorValue } from "react-native";
import { useT } from "../../lib/i18n.tsx";
import { useTheme } from "../../lib/theme.tsx";

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => (
  <Text style={{ fontSize: 20, color }}>{glyph}</Text>
);

export default function TabsLayout() {
  const t = useT();
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.navActive,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surfaceRaised, borderTopColor: c.border },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.label.native,
          letterSpacing: theme.label.letterSpacing,
          textTransform: theme.label.uppercase ? "uppercase" : "none",
        },
        headerStyle: { backgroundColor: c.surfaceRaised },
        headerTitleStyle: { fontFamily: theme.fonts.heading.native, color: c.text },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("cellar"), tabBarIcon: icon("🍷") }} />
      <Tabs.Screen name="scan" options={{ title: t("scan"), tabBarIcon: icon("▦") }} />
      <Tabs.Screen name="history" options={{ title: t("history"), tabBarIcon: icon("↺") }} />
      <Tabs.Screen name="profile" options={{ title: t("profile"), tabBarIcon: icon("☺") }} />
    </Tabs>
  );
}
