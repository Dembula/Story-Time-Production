/**
 * Decide when Next/Vercel Image Optimization must be skipped.
 *
 * Prefer optimizing only stable public CDN / same-origin paths.
 * Always bypass signed S3 query URLs (unique every hour → transform quota burn).
 */
export function shouldBypassImageOptimization(src: string | null | undefined): boolean {
  const value = src?.trim();
  if (!value) return false;
  if (value.startsWith("data:") || value.startsWith("blob:")) return true;

  // Catalogue proxy redirects to signed URLs — do not send through Image Optimization
  // (optimizer would chase redirects / unique signatures and thrash quota).
  if (value.startsWith("/api/media/catalogue/")) return true;

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

    // Private S3 virtual-host URLs without a signature cannot be optimized usefully.
    if (
      /\.amazonaws\.com$/i.test(url.hostname) &&
      !url.searchParams.has("X-Amz-Signature")
    ) {
      return true;
    }
  } catch {
    return true;
  }

  return false;
}
