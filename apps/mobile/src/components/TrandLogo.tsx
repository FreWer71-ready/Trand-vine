// TrandWines logotyp, från Trands appikoner (https://trand.se/brand/appikoner/), som PNG i tre gångers
// storlek. Lockupen har namnet inbyggt: dark-varianten (ljus text) till mörkt tema, light-varianten
// (mörk text) till ljust. Märket är appikonen och ser likadan ut i båda temana.

import { Image, View } from "react-native";
import { useTheme } from "../lib/theme.tsx";

const MARK = { src: require("../../assets/brand/trandwine-mark.png"), ratio: 1 };
const SOURCES = {
  mark: { dark: MARK, light: MARK },
  lockup: {
    dark: { src: require("../../assets/brand/trandwine-lockup-dark.png"), ratio: 381 / 90 },
    light: { src: require("../../assets/brand/trandwine-lockup-light.png"), ratio: 381 / 90 },
  },
} as const;

/**
 * mark = appikonen, lockup = märke och namn. height i px. tone väljer
 * variant oberoende av tema, t.ex. "dark" (ljus text) på ett färgat sidhuvud.
 */
export function TrandLogo({
  variant = "lockup",
  height = 28,
  tone,
}: {
  variant?: keyof typeof SOURCES;
  height?: number;
  tone?: "light" | "dark";
}) {
  const { mode } = useTheme();
  const { src, ratio } = SOURCES[variant][tone ?? mode];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="TrandWine">
      <Image source={src} resizeMode="contain" style={{ height, width: height * ratio }} />
    </View>
  );
}
