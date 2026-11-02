// Trands logotyp (https://trand.se/brand/index.html), som PNG i tre gångers
// storlek. Dark-varianten är till mörkt tema, light-varianten till ljust.
// Monogrammet är en mörk ikonruta i mörkt tema och bara märket i ljust.

import { Image, View } from "react-native";
import { useTheme } from "../lib/theme.tsx";

const SOURCES = {
  mark: {
    dark: { src: require("../../assets/brand/trand-mark-dark.png"), ratio: 1 },
    light: { src: require("../../assets/brand/trand-mark-light.png"), ratio: 64 / 50 },
  },
  lockup: {
    dark: { src: require("../../assets/brand/trand-lockup-dark.png"), ratio: 419 / 90 },
    light: { src: require("../../assets/brand/trand-lockup-light.png"), ratio: 419 / 90 },
  },
} as const;

/** mark = monogrammet, lockup = monogram och ordmärke. height i px. */
export function TrandLogo({ variant = "lockup", height = 28 }: { variant?: keyof typeof SOURCES; height?: number }) {
  const { mode } = useTheme();
  const { src, ratio } = SOURCES[variant][mode];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Trand">
      <Image source={src} resizeMode="contain" style={{ height, width: height * ratio }} />
    </View>
  );
}
