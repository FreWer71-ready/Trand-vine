// Appens tema från designsystemet (packages/design): "tour" (Mallorca) är
// TrandWines utseende. EXPO_PUBLIC_APP_THEME=party ger Partyplan-utseendet,
// t.ex. för att förhandsgranska.

import { AbrilFatface_400Regular } from "@expo-google-fonts/abril-fatface";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from "@expo-google-fonts/fredoka";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import { Lora_400Regular, Lora_600SemiBold } from "@expo-google-fonts/lora";
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from "@expo-google-fonts/nunito";
import { SpecialElite_400Regular } from "@expo-google-fonts/special-elite";
import { getTheme, nativeFontNames, type Theme, type ThemeFamily } from "@trand-vine/design";
import { useFonts } from "expo-font";
import { createContext, useContext, type ReactNode } from "react";
import { useColorScheme } from "react-native";

export const APP_THEME: ThemeFamily = process.env.EXPO_PUBLIC_APP_THEME === "party" ? "party" : "tour";

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
  const scheme = useColorScheme();
  const theme = getTheme(family, scheme === "dark" ? "dark" : "light");
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
