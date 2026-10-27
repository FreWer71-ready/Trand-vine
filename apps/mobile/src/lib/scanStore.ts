// Håller senaste skanningsresultatet mellan skanningsvyn och registreringen,
// så att stora objekt inte behöver skickas som URL-parametrar.

import { router } from "expo-router";
import type { ScanResult, WineRow } from "./api.ts";

let pending: ScanResult | null = null;

/** Vin som ska läggas till igen, med årgång och storlek från en tidigare flaska. */
export interface AddAgain {
  wine: WineRow;
  year: number | null;
  sizeMl: number;
  location: string | null;
}

let again: AddAgain | null = null;

export function setPendingScan(result: ScanResult | null) {
  pending = result;
  again = null;
}

/** Öppnar registreringen utan streckkod: sök eller lägg till vinet för hand. */
export function openManualAdd() {
  pending = null;
  again = null;
  router.push("/register");
}

/** "Lägg till igen": hoppar direkt till detaljerna med vinet förvalt. */
export function openAddAgain(a: AddAgain) {
  pending = null;
  again = a;
  router.push("/register");
}

export function getAddAgain(): AddAgain | null {
  return again;
}

/**
 * Senaste resultatet. Töms inte vid läsning: registreringen kan monteras mer
 * än en gång när den öppnas, och varje skanning eller manuell start sätter
 * ett nytt värde ändå.
 */
export function getPendingScan(): ScanResult | null {
  return pending;
}
