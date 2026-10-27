// Kom ihåg att användaren har tillåtit kameran (webb).
//
// I telefonappen sparar operativsystemet tillståndet. I webbläsaren svarar
// permissions-API:t ofta "fråga" även efter ett ja (Safari), så appen visade
// sin egen "Tillåt kamera"-skärm varje gång och frågade sedan två gånger.
// Har användaren sagt ja en gång startar vi kameran direkt i stället;
// webbläsaren frågar då högst en gång, och inte alls om den minns svaret.

import { Platform } from "react-native";

const KEY = "trandvine.cameraAllowed";

export function cameraRemembered(): boolean {
  if (Platform.OS !== "web") return false;
  try {
    return globalThis.localStorage?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberCamera(allowed: boolean) {
  if (Platform.OS !== "web") return;
  try {
    if (allowed) globalThis.localStorage?.setItem(KEY, "1");
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // Privat läge eller blockerad lagring: då frågar webbläsaren som vanligt.
  }
}
