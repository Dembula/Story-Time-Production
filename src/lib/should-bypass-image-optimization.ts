/**
 * Remote catalogue art (esp. S3 presigned URLs) must not go through Vercel Image Optimization:
 * - each unique signature is billed as a new transformation and burns the monthly quota
 * - once the quota is exhausted, `/_next/image` returns HTTP 402 and posters appear broken
 * - GIFs / signed query strings also break or thrash the optimizer cache key
 */
export function shouldBypassImageOptimization(src: string | null | undefined): boolean {
  const value = src?.trim();
  if (!value) return false;
  if (value.startsWith("data:") || value.startsWith("blob:")) return true;
  if (!/^https?:\/\//i.test(value)) return false;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      host.includes("amazonaws.com") ||
      host.includes("cloudfront.net") ||
      host.includes("r2.cloudflarestorage.com") ||
      host.endsWith(".supabase.co") ||
      host.includes("videodelivery.net") ||
      host.includes("cloudflarestream.com")
    ) {
      return true;
    }
    if (
      url.searchParams.has("X-Amz-Signature") ||
      url.searchParams.has("X-Amz-Credential") ||
      url.searchParams.has("Signature") ||
      url.searchParams.has("token")
    ) {
      return true;
    }
    if (/\.gif($|\?)/i.test(url.pathname) || url.pathname.toLowerCase().endsWith(".gif")) {
      return true;
    }
  } catch {
    return true;
  }

  return false;
}
