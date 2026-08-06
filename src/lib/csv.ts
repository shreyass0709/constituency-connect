/**
 * CSV that actually opens in Excel — which is the whole requirement (gate M5).
 *
 * Three things break real exports, and all three are handled here:
 *  - a comma, quote or newline inside a value ⇒ quote the field, double the quotes
 *  - a value starting with `=`, `+`, `-` or `@` ⇒ Excel runs it as a formula, so it is
 *    prefixed with a tab (CSV injection is a genuine attack, not a formatting nit)
 *  - Indic text ⇒ Excel assumes the system codepage unless the file starts with a BOM
 */

const BOM = "﻿";
const NEEDS_QUOTING = /[",\r\n]/;
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text =
    value instanceof Date
      ? value.toISOString().slice(0, 19).replace("T", " ")
      : String(value);

  // Neutralise anything Excel would evaluate rather than display.
  if (FORMULA_START.test(text)) text = `\t${text}`;

  return NEEDS_QUOTING.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))];
  // CRLF is what Excel expects; the BOM is what makes it read the file as UTF-8.
  return BOM + lines.join("\r\n") + "\r\n";
}

/** A download response with a filename the browser will actually use. */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "cache-control": "no-store",
    },
  });
}
