/** Best-effort absolute base for emails (no trailing slash). */
export function getAppBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  if (process.env.NODE_ENV === "production") return "https://story-time.online";
  return "";
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Public site origin for user-facing email links (password reset, invites).
 * Prefer story-time.online; never emit ephemeral *.vercel.app preview hosts in production.
 */
export function getCanonicalPublicBaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
  ]
    .map((u) => u?.trim().replace(/\/$/, "") || "")
    .filter(Boolean);

  const production = candidates.find((u) => {
    const host = hostnameOf(u);
    return host === "story-time.online" || host === "www.story-time.online";
  });
  if (production) return production;

  const nonPreview = candidates.find((u) => {
    const host = hostnameOf(u);
    return Boolean(host && !host.endsWith(".vercel.app"));
  });
  if (nonPreview) return nonPreview;

  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return "https://story-time.online";
  }

  return getAppBaseUrl() || "https://story-time.online";
}

export function buildAppUrl(path: string): string {
  const base = getAppBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

/** Absolute URL for emails / SMS — uses the canonical public host. */
export function buildPublicAppUrl(path: string): string {
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
