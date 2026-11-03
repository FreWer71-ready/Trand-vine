import { Tabs } from "expo-router/tabs";
import { Text, View, type ColorValue } from "react-native";
import { TrandLogo } from "../../components/TrandLogo.tsx";
import { useT } from "../../lib/i18n.tsx";
import { isLightColor, useTheme } from "../../lib/theme.tsx";

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
        tabBarInactiveTintColor: c.onSurfaceRaisedMuted,
        tabBarStyle: { backgroundColor: c.surfaceRaised, borderTopColor: c.border },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.label.native,
          letterSpacing: theme.label.letterSpacing,
          textTransform: theme.label.uppercase ? "uppercase" : "none",
        },
        // Loggan med namnet till vänster, följd av flikens namn så att man ser var man är.
        // Sidhuvudet ligger på surface-raised; loggan har ljus text där texten på det är ljus.
        headerStyle: { backgroundColor: c.surfaceRaised },
        headerLeft: () => (
          <View style={{ marginLeft: theme.space.lg, marginRight: theme.space.md }}>
            <TrandLogo variant="lockup" height={24} tone={isLightColor(c.onSurfaceRaised) ? "dark" : "light"} />
          </View>
        ),
        headerTitleAlign: "left",
        headerTitleStyle: { fontFamily: theme.fonts.heading.native, fontSize: theme.type.body, color: c.onSurfaceRaised },
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
