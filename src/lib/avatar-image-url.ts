const MAX_LEN = 2048;

/** Returns normalized https? URL string, or null to clear. */
export function normalizeAvatarImageUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.length > MAX_LEN) {
    throw new Error(`URL must be at most ${MAX_LEN} characters`);
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error("Enter a valid URL (e.g. https://…)");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Image URL must start with http:// or https://");
  }
  return u.toString();
}

export function tryNormalizeAvatarImageUrl(raw: string): { ok: true; value: string | null } | { ok: false; message: string } {
  try {
    return { ok: true, value: normalizeAvatarImageUrl(raw) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid URL";
    return { ok: false, message };
  }
}
