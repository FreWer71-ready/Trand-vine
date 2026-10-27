// Hjälp för att skriva data som psql COPY ... FROM stdin (CSV-format).

/** Ett CSV-fält för COPY. null → tomt fält utan citattecken (= NULL). */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) || s === "" ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(values: Array<string | number | null | undefined>): string {
  return values.map(csvField).join(",") + "\n";
}

/** Postgres-arrayliteral, t.ex. {"Merlot","Cabernet Sauvignon"}. */
export function pgArray(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`;
}

export interface Writer {
  write(chunk: string): void;
}
