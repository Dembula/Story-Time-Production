/** Parse newline- or comma-separated photo URL lists from listing fields. */
export function parsePhotoUrls(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("http://") || s.startsWith("https://"));
}

export function firstPhotoUrl(raw: string | null | undefined): string | null {
  return parsePhotoUrls(raw)[0] ?? null;
}
