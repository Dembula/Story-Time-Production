/** Best-effort absolute base for emails (no trailing slash). */
export function getAppBaseUrl(): string {
  const u = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (u) return u;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "";
}

export function buildAppUrl(path: string): string {
  const base = getAppBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
