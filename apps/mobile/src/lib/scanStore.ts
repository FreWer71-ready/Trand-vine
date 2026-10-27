// Håller senaste skanningsresultatet mellan skanningsvyn och registreringen,
// så att stora objekt inte behöver skickas som URL-parametrar.

import type { ScanResult } from "./api.ts";

let pending: ScanResult | null = null;

export function setPendingScan(result: ScanResult | null) {
  pending = result;
}

export function takePendingScan(): ScanResult | null {
  const r = pending;
  pending = null;
  return r;
}
