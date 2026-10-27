import { describe, expect, it } from "vitest";
import { familyCss, googleFontsUrl, themeVariables } from "../src/css.ts";
import { getTheme, nativeFontNames, party, themes, tourDark, tourLight, type Theme } from "../src/tokens.ts";

// WCAG-kontrast mellan två hexfärger.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
};
const all: Theme[] = [party, tourLight, tourDark];

describe("tokens", () => {
  it("every theme defines the same token keys", () => {
    const keys = (t: Theme) => JSON.stringify([Object.keys(t.colors), Object.keys(t.fonts), Object.keys(t.radius)]);
    for (const t of all) expect(keys(t)).toBe(keys(party));
  });

  it.each(all.map((t) => [t.name, t] as const))("%s has readable text and buttons (WCAG AA)", (_, t) => {
    expect(contrast(t.colors.text, t.colors.background)).toBeGreaterThanOrEqual(7);
    expect(contrast(t.colors.onPrimary, t.colors.primary)).toBeGreaterThanOrEqual(4.5);
    for (const c of [t.colors.success, t.colors.warning, t.colors.danger]) {
      expect(contrast(c, t.colors.background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("party is always dark, tour follows the mode", () => {
    expect(getTheme("party", "light")).toBe(party);
    expect(getTheme("tour", "light")).toBe(tourLight);
    expect(getTheme("tour", "dark")).toBe(tourDark);
  });

  it("lists native fonts to load", () => {
    expect(nativeFontNames("tour")).toContain("AbrilFatface_400Regular");
    expect(nativeFontNames("party")).toContain("Fredoka_700Bold");
  });
});

describe("css", () => {
  it("emits semantic variables", () => {
    const v = themeVariables(themes.tour.light);
    expect(v["--color-primary"]).toBe("#6e1d2b");
    expect(v["--font-display"]).toContain("Abril Fatface");
    expect(v["--radius-card"]).toBe("12px");
  });

  it("emits light and dark blocks for tour, a single dark block for party", () => {
    expect(familyCss("tour")).toContain('@media (prefers-color-scheme: dark)');
    expect(familyCss("tour")).toContain(':root[data-theme="dark"]');
    expect(familyCss("party")).not.toContain("prefers-color-scheme");
  });

  it("builds a Google Fonts URL", () => {
    expect(googleFontsUrl("party")).toBe(
      "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700&display=swap",
    );
  });
});
