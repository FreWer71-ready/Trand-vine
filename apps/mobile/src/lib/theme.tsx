// Appens tema från FreWer71 Designsystem (packages/design): TrandWine använder
// familjen Trand, som ser ut som TrandStyle. EXPO_PUBLIC_APP_THEME=tour eller
// party ger de andra utseendena, t.ex. för att förhandsgranska.

import { AbrilFatface_400Regular } from "@expo-google-fonts/abril-fatface";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from "@expo-google-fonts/fredoka";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { Lora_400Regular, Lora_600SemiBold } from "@expo-google-fonts/lora";
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from "@expo-google-fonts/nunito";
import { SpecialElite_400Regular } from "@expo-google-fonts/special-elite";
import { getTheme, nativeFontNames, type Theme, type ThemeFamily } from "@trand-vine/design";
import { useFonts } from "expo-font";
import { createContext, useContext, type ReactNode } from "react";

const THEME_ENV = process.env.EXPO_PUBLIC_APP_THEME;
export const APP_THEME: ThemeFamily = THEME_ENV === "party" || THEME_ENV === "tour" ? THEME_ENV : "trand";

const FONT_ASSETS: Record<string, number> = {
  AbrilFatface_400Regular,
  Fraunces_600SemiBold,
  Lora_400Regular,
  Lora_600SemiBold,
  SpecialElite_400Regular,
  IBMPlexMono_500Medium,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

/** Laddar temats typsnitt. Returnerar true när de är klara (eller misslyckades). */
export function useThemeFonts(family: ThemeFamily = APP_THEME): boolean {
  const names = nativeFontNames(family);
  const missing = names.filter((n) => !(n in FONT_ASSETS));
  if (missing.length) throw new Error(`Typsnitt saknas i FONT_ASSETS: ${missing.join(", ")}`);
  const [loaded, error] = useFonts(Object.fromEntries(names.map((n) => [n, FONT_ASSETS[n]!])));
  // Vid fel visas appen ändå, med systemets typsnitt.
  return loaded || !!error;
}

const ThemeContext = createContext<Theme>(getTheme(APP_THEME, "light"));

export function ThemeProvider({ children, family = APP_THEME }: { children: ReactNode; family?: ThemeFamily }) {
  // Mörkt är standard: skärmen är alltid på. EXPO_PUBLIC_APP_MODE=light ger ljust läge.
  const theme = getTheme(family, process.env.EXPO_PUBLIC_APP_MODE === "light" ? "light" : "dark");
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Är färgen ljus? För att välja logga (ljus eller mörk text) efter en tokens färg. */
export function isLightColor(color: string): boolean {
  const rgba = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  const [r, g, b] = rgba
    ? [rgba[1], rgba[2], rgba[3]].map(Number)
    : [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  return 0.299 * r! + 0.587 * g! + 0.114 * b! > 150;
}
