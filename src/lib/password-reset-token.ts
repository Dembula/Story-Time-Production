/** Raw reset tokens are 32 random bytes encoded as hex (64 chars). */
const RESET_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const PATH_TOKEN_PATTERN = /\/(?:auth\/)?reset-password\/([a-f0-9]{64})\b/i;

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
  value = value.replace(/\s+/g, "");
  if (/^[a-f0-9]+$/i.test(value)) {
    return value.toLowerCase();
  }
  return value;
}

export function isPasswordResetTokenFormat(token: string): boolean {
  return RESET_TOKEN_PATTERN.test(token);
}

/** Read reset token from a full URL, query string, path segment, or hash. */
export function extractPasswordResetTokenFromUrl(href: string): string {
  if (!href) return "";

  try {
    const parsed = new URL(href, typeof window !== "undefined" ? window.location.origin : "https://story-time.online");

    for (const key of ["token", "reset_token", "resetToken", "t"]) {
      const fromQuery = parsed.searchParams.get(key);
      if (fromQuery) {
        const normalized = normalizePasswordResetToken(fromQuery);
        if (normalized) return normalized;
      }
    }

    const hashBody = parsed.hash.replace(/^#/, "");
    if (hashBody) {
      const hashParams = new URLSearchParams(hashBody.includes("=") ? hashBody : `token=${hashBody}`);
      for (const key of ["token", "reset_token", "resetToken", "t"]) {
        const fromHash = hashParams.get(key);
        if (fromHash) {
          const normalized = normalizePasswordResetToken(fromHash);
          if (normalized) return normalized;
        }
      }
    }

    const pathMatch = parsed.pathname.match(PATH_TOKEN_PATTERN);
    if (pathMatch?.[1]) {
      return normalizePasswordResetToken(pathMatch[1]);
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && !["auth", "reset-password", "forgot-password"].includes(last.toLowerCase())) {
      const normalized = normalizePasswordResetToken(last);
      if (isPasswordResetTokenFormat(normalized)) return normalized;
    }
  } catch {
    // fall through
  }

  return "";
}
