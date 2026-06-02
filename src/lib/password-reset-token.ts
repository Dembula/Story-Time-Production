/** Raw reset tokens are 32 random bytes encoded as hex (64 chars). */
const RESET_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export function normalizePasswordResetToken(raw: string | null | undefined): string {
  if (!raw) return "";
  let value = raw.trim();
  if (!value) return "";

  try {
    value = decodeURIComponent(value);
  } catch {
    // keep original when not URI-encoded
  }

  // Email clients sometimes wrap long URLs and insert whitespace.
  return value.replace(/\s+/g, "");
}

export function isPasswordResetTokenFormat(token: string): boolean {
  return RESET_TOKEN_PATTERN.test(token);
}
