/** RFC-style CSV cell escaping for dashboard exports. */

export function csvEscapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const head = headers.map(csvEscapeCell).join(",");
  const body = rows.map((r) => r.map(csvEscapeCell).join(",")).join("\r\n");
  return `${head}\r\n${body}`;
}
