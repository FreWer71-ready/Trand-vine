import { Tabs } from "expo-router/tabs";
import { Text, type ColorValue } from "react-native";
import { colors } from "../../components/ui.tsx";
import { useT } from "../../lib/i18n.tsx";

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => (
  <Text style={{ fontSize: 20, color }}>{glyph}</Text>
);

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.wine, headerTintColor: colors.text }}>
      <Tabs.Screen name="index" options={{ title: t("cellar"), tabBarIcon: icon("🍷") }} />
      <Tabs.Screen name="scan" options={{ title: t("scan"), tabBarIcon: icon("▦") }} />
      <Tabs.Screen name="history" options={{ title: t("history"), tabBarIcon: icon("↺") }} />
      <Tabs.Screen name="profile" options={{ title: t("profile"), tabBarIcon: icon("☺") }} />
    </Tabs>
  );
}
