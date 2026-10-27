// Skriver ut temats CSS för webbappar: npm run css -w @trand-vine/design -- tour > theme.css
import { familyCss, googleFontsUrl } from "./css.ts";
import type { ThemeFamily } from "./tokens.ts";

const family = process.argv[2] as ThemeFamily;
if (family !== "party" && family !== "tour") {
  console.error("Användning: cli.ts party|tour");
  process.exit(1);
}
process.stdout.write(`/* Typsnitt: <link rel="stylesheet" href="${googleFontsUrl(family)}"> */\n\n${familyCss(family)}`);
