// CSS för webbappar (Next.js/Tailwind v4, Vite m.fl.): custom properties per
// tema och en Google Fonts-länk. Variabelnamnen är semantiska, t.ex.
// --color-primary, --font-heading, --radius-card.

import { themes, type Theme, type ThemeFamily } from "./tokens.ts";

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function themeVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.colors)) vars[`--color-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(theme.fonts)) vars[`--font-${kebab(k)}`] = v.css;
  for (const [k, v] of Object.entries(theme.radius)) vars[`--radius-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(theme.space)) vars[`--space-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(theme.type)) vars[`--text-${k}`] = `${v}px`;
  vars["--background-page"] = theme.backgroundCss;
  return vars;
}

const block = (selector: string, vars: Record<string, string>, extra = "") =>
  `${selector} {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n")}${extra}\n}\n`;

/**
 * Komplett stilmall för en familj. Ljust läge på :root, mörkt via
 * prefers-color-scheme och [data-theme="dark"]; party är alltid mörk.
 */
export function familyCss(family: ThemeFamily): string {
  const { light, dark } = themes[family];
  if (light === dark) {
    return block(":root", themeVariables(dark), "\n  color-scheme: dark;");
  }
  const darkVars = themeVariables(dark);
  return [
    block(":root", themeVariables(light), "\n  color-scheme: light;"),
    `@media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme="light"])', darkVars, "\n  color-scheme: dark;")}}\n`,
    block(':root[data-theme="dark"]', darkVars, "\n  color-scheme: dark;"),
  ].join("\n");
}

export function googleFontsUrl(family: ThemeFamily): string {
  const families = [...new Set(Object.values(themes[family].light.fonts).map((f) => f.google.split(":")[0]!))];
  const byFamily = new Map<string, Set<string>>();
  for (const f of Object.values(themes[family].light.fonts)) {
    const [name, axis] = f.google.split(":") as [string, string | undefined];
    const weights = byFamily.get(name) ?? new Set<string>();
    if (axis) weights.add(axis.replace("wght@", ""));
    byFamily.set(name, weights);
  }
  const params = families.map((name) => {
    const w = [...byFamily.get(name)!].sort();
    return `family=${name}${w.length ? `:wght@${w.join(";")}` : ""}`;
  });
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}
