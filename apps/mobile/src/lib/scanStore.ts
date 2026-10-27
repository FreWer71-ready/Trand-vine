// Håller senaste skanningsresultatet mellan skanningsvyn och registreringen,
// så att stora objekt inte behöver skickas som URL-parametrar.

import { router } from "expo-router";
import type { ScanResult } from "./api.ts";

let pending: ScanResult | null = null;

export function setPendingScan(result: ScanResult | null) {
  pending = result;
}

/** Öppnar registreringen utan streckkod: sök eller lägg till vinet för hand. */
export function openManualAdd() {
  pending = null;
  router.push("/register");
}

/**
 * Senaste resultatet. Töms inte vid läsning: registreringen kan monteras mer
 * än en gång när den öppnas, och varje skanning eller manuell start sätter
 * ett nytt värde ändå.
 */
export function getPendingScan(): ScanResult | null {
  return pending;
}
