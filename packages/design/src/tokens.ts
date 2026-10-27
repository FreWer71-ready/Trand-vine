// Designsystem för FreWer71:s appar. Två familjer med samma semantiska
// tokens, så att en app byter utseende genom att byta tema:
//
//   party – "nöjesappar". Utgår från Partyplan (Fredrik55): natthimmel,
//           cerise, turkos och solgul, rundade former, knappar med 3D-tryck.
//   tour  – utgår från Mallorca Golf Tour: vintageaffisch med pergament,
//           vinröd och guld, serifer och skrivmaskinsetiketter.
//
// Komponenter ska bara läsa semantiska tokens (surface, primary, …), aldrig
// palettens råa färger, så att de fungerar i båda familjerna.

export type ThemeFamily = "party" | "tour";
export type ColorMode = "light" | "dark";

export interface ColorTokens {
  /** Sidans bakgrund. */
  background: string;
  /** Kort, fält och listrader. */
  surface: string;
  /** Upphöjd yta: dialoger, flikrad, sidhuvud. */
  surfaceRaised: string;
  /** Markerat kort (t.ex. "Du har haft detta vin förut"). */
  highlight: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  /** Kantfärg/skugga under primärknappen (3D-tryck i party, kant i tour). */
  primaryEdge: string;
  secondary: string;
  onSecondary: string;
  secondaryEdge: string;
  /** Liten accent: rubrikdetaljer, stjärnor. */
  accent: string;
  /** Aktiv flik och länkar i navigeringen. */
  navActive: string;
  success: string;
  warning: string;
  danger: string;
  /** Text på färgade chips/taggar. */
  tag: string;
  onTag: string;
}

export interface FontToken {
  /** CSS font-family-stack för webben. */
  css: string;
  /** Typsnittsnamn i React Native (från @expo-google-fonts). */
  native: string;
  /** Google Fonts-familj och vikt, för att ladda typsnittet på webben. */
  google: string;
}

export interface FontTokens {
  /** Stora rubriker, används sparsamt. */
  display: FontToken;
  /** Sektionsrubriker och korttitlar. */
  heading: FontToken;
  body: FontToken;
  bodyStrong: FontToken;
  /** Små etiketter, knappar i tour. */
  label: FontToken;
  /** Siffror och tabeller. */
  data: FontToken;
}

export interface Theme {
  family: ThemeFamily;
  mode: ColorMode;
  name: string;
  colors: ColorTokens;
  fonts: FontTokens;
  /** Typskala i px. */
  type: { display: number; title: number; heading: number; body: number; small: number; label: number };
  /** Avståndsskala i px. */
  space: { xs: number; sm: number; md: number; lg: number; xl: number };
  radius: { card: number; button: number; field: number; chip: number };
  button: {
    /** press = färgad kant under knappen som försvinner vid tryck (party). flat = platt med ram (tour). */
    style: "press" | "flat";
    uppercase: boolean;
    letterSpacing: number;
    font: keyof FontTokens;
    edgeHeight: number;
  };
  /** Etiketter ovanför fält och små rubriker. */
  label: { uppercase: boolean; letterSpacing: number };
  /** Bakgrundsglöd för webben (party). */
  backgroundCss: string;
}

const font = (css: string, native: string, google: string): FontToken => ({ css, native, google });

// ---------------------------------------------------------------- party ---

const partyPalette = {
  natt: "#150a33",
  natt2: "#21134a",
  natt3: "#2f1d63",
  cerise: "#e6007e",
  ceriseLjus: "#ff4fa8",
  ceriseKant: "#8a004b",
  turkos: "#00d1c9",
  turkosKant: "#007d78",
  solgul: "#ffd23f",
  klarbla: "#2f6bff",
  orange: "#ff7a1a",
  lila: "#b69cff",
  ok: "#6ff0a0",
  faraLjus: "#ff8a9a",
};

const partyFonts: FontTokens = {
  display: font('"Fredoka", ui-rounded, system-ui, sans-serif', "Fredoka_700Bold", "Fredoka:wght@700"),
  heading: font('"Fredoka", ui-rounded, system-ui, sans-serif', "Fredoka_600SemiBold", "Fredoka:wght@600"),
  body: font('"Nunito", system-ui, sans-serif', "Nunito_400Regular", "Nunito:wght@400"),
  bodyStrong: font('"Nunito", system-ui, sans-serif', "Nunito_700Bold", "Nunito:wght@700"),
  label: font('"Nunito", system-ui, sans-serif', "Nunito_600SemiBold", "Nunito:wght@600"),
  data: font('"Fredoka", ui-rounded, system-ui, sans-serif', "Fredoka_500Medium", "Fredoka:wght@500"),
};

export const party: Theme = {
  family: "party",
  mode: "dark",
  name: "Fest (Partyplan)",
  colors: {
    background: partyPalette.natt,
    surface: "rgba(255,255,255,0.10)",
    surfaceRaised: partyPalette.natt2,
    highlight: "rgba(255,210,63,0.16)",
    border: "rgba(255,255,255,0.18)",
    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.68)",
    primary: partyPalette.cerise,
    onPrimary: "#ffffff",
    primaryEdge: partyPalette.ceriseKant,
    secondary: partyPalette.turkos,
    onSecondary: partyPalette.natt,
    secondaryEdge: partyPalette.turkosKant,
    accent: partyPalette.solgul,
    navActive: partyPalette.solgul,
    success: partyPalette.ok,
    warning: partyPalette.orange,
    danger: partyPalette.faraLjus,
    tag: "rgba(182,156,255,0.22)",
    onTag: "#ffffff",
  },
  fonts: partyFonts,
  type: { display: 34, title: 26, heading: 19, body: 16, small: 14, label: 13 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { card: 24, button: 16, field: 16, chip: 999 },
  button: { style: "press", uppercase: false, letterSpacing: 0.3, font: "heading", edgeHeight: 6 },
  label: { uppercase: false, letterSpacing: 0 },
  backgroundCss: [
    "radial-gradient(circle at 10% 0%, rgb(230 0 126 / 0.35), transparent 40%)",
    "radial-gradient(circle at 95% 10%, rgb(0 209 201 / 0.28), transparent 38%)",
    "radial-gradient(circle at 50% 110%, rgb(47 107 255 / 0.35), transparent 45%)",
    partyPalette.natt,
  ].join(", "),
};

// ----------------------------------------------------------------- tour ---

const tourFonts: FontTokens = {
  display: font('"Abril Fatface", Georgia, serif', "AbrilFatface_400Regular", "Abril+Fatface"),
  heading: font('"Fraunces", Georgia, serif', "Fraunces_600SemiBold", "Fraunces:wght@600"),
  body: font('"Lora", Georgia, serif', "Lora_400Regular", "Lora:wght@400"),
  bodyStrong: font('"Lora", Georgia, serif', "Lora_600SemiBold", "Lora:wght@600"),
  label: font('"Special Elite", ui-monospace, monospace', "SpecialElite_400Regular", "Special+Elite"),
  data: font('"IBM Plex Mono", ui-monospace, monospace', "IBMPlexMono_500Medium", "IBM+Plex+Mono:wght@500"),
};

const tourBase = {
  family: "tour" as const,
  fonts: tourFonts,
  type: { display: 32, title: 26, heading: 18, body: 16, small: 14, label: 12 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { card: 12, button: 8, field: 8, chip: 999 },
  button: { style: "flat" as const, uppercase: true, letterSpacing: 1.2, font: "label" as const, edgeHeight: 0 },
  label: { uppercase: true, letterSpacing: 1 },
};

export const tourLight: Theme = {
  ...tourBase,
  mode: "light",
  name: "Tour (Mallorca), ljus",
  colors: {
    background: "#fcf7ed", // paper
    surface: "#f6ecd4",
    surfaceRaised: "#efdfb8", // parchment
    highlight: "#f1dcc0",
    border: "rgba(44,31,20,0.32)",
    text: "#1b2a41", // ink
    textMuted: "#454034", // ink-soft
    primary: "#7a2331", // maroon
    onPrimary: "#fbf4e3",
    primaryEdge: "#5e1a24",
    secondary: "transparent",
    onSecondary: "#1b2a41",
    secondaryEdge: "#8f6a32", // gold
    accent: "#8f6a32",
    navActive: "#7a2331",
    success: "#3b4a33", // fairway
    warning: "#8f5a12",
    danger: "#7a2331",
    tag: "#efdfb8",
    onTag: "#2c1f14",
  },
  backgroundCss: "#fcf7ed",
};

export const tourDark: Theme = {
  ...tourBase,
  mode: "dark",
  name: "Tour (Mallorca), mörk",
  colors: {
    background: "#100c07",
    surface: "#1d160d",
    surfaceRaised: "#2b2115",
    highlight: "#3a1f22",
    border: "rgba(230,214,170,0.24)",
    text: "#f1e6c8",
    textMuted: "#c9bc9c",
    primary: "#b83d50", // Mallorcas #c24558, något mörkare för läsbar knapptext (WCAG AA)
    onPrimary: "#fbf4e3",
    primaryEdge: "#e0687a",
    secondary: "transparent",
    onSecondary: "#f1e6c8",
    secondaryEdge: "#c9a15c",
    accent: "#e0bd7c",
    navActive: "#e0bd7c",
    success: "#8fa379",
    warning: "#e0bd7c",
    danger: "#e0687a",
    tag: "#2b2115",
    onTag: "#f1e6c8",
  },
  backgroundCss: "#100c07",
};

export const themes = {
  party: { light: party, dark: party }, // Partyplan är alltid mörk.
  tour: { light: tourLight, dark: tourDark },
} satisfies Record<ThemeFamily, Record<ColorMode, Theme>>;

export function getTheme(family: ThemeFamily, mode: ColorMode): Theme {
  return themes[family][mode];
}

/** Alla typsnitt en familj använder, t.ex. för att ladda dem i förväg. */
export function nativeFontNames(family: ThemeFamily): string[] {
  const all = [themes[family].light, themes[family].dark].flatMap((t) => Object.values(t.fonts).map((f) => f.native));
  return [...new Set(all)];
}
