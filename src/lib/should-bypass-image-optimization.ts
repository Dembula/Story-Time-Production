/**
 * Decide when Next/Vercel Image Optimization must be skipped.
 *
 * Stable catalogue URLs (`/api/media/catalogue/...` and public CDN hosts without
 * signatures) SHOULD be optimized. Only bypass true signed/private query URLs and GIFs.
 */
export function shouldBypassImageOptimization(src: string | null | undefined): boolean {
  const value = src?.trim();
  if (!value) return false;
  if (value.startsWith("data:") || value.startsWith("blob:")) return true;

  // Same-origin catalogue proxy — always optimizable.
  if (value.startsWith("/api/media/catalogue/")) return false;

  if (!/^https?:\/\//i.test(value)) {
    // Local/public path (e.g. /posters/*.svg) — let Next handle it.
    return false;
  }

  try {
    const url = new URL(value, "https://story-time.online");
    if (
      url.searchParams.has("X-Amz-Signature") ||
      url.searchParams.has("X-Amz-Credential") ||
      url.searchParams.has("X-Amz-Security-Token") ||
      url.searchParams.has("Signature") ||
      url.searchParams.has("X-Amz-Date")
    ) {
      return true;
    }

    const path = url.pathname.toLowerCase();
    if (path.endsWith(".gif") || /\.gif$/i.test(path)) return true;

    // Stream animated thumbs / customer playback hosts — leave as-is.
    if (url.hostname.includes("videodelivery.net") || url.hostname.includes("cloudflarestream.com")) {
      return true;
    }
  } catch {
    return true;
  }

  return false;
}
