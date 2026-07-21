import { getStorageObjectSignedUrl } from "@/lib/storage-object-fetch";
import { resolveStorageObjectRef } from "@/lib/storage-object-ref";
import { normalizeStorageMediaUrl } from "@/lib/pack-storage-media-url";
import { isCloudflareStreamUrl } from "@/lib/cloudflare-stream";

/**
 * Cloudflare Stream "copy from URL" needs a URL it can fetch without browser cookies.
 * Prefer a long-lived signed S3 GET when the object lives in platform storage (private buckets).
 */
export async function resolveIngestSourceUrlForCloudflare(
  sourceUrlOrRef: string,
): Promise<string | null> {
  const trimmed = sourceUrlOrRef.trim();
  if (!trimmed) return null;
  if (isCloudflareStreamUrl(trimmed)) return trimmed;

  const normalized = normalizeStorageMediaUrl(trimmed) ?? trimmed;
  const ref = resolveStorageObjectRef(trimmed) ?? resolveStorageObjectRef(normalized);
  if (ref) {
    try {
      // 12h — enough for Cloudflare to pull large feature masters.
      return await getStorageObjectSignedUrl(ref, 60 * 60 * 12);
    } catch (err) {
      console.error("Signed ingest URL failed; falling back to public source URL:", err);
    }
  }

  if (/^https?:\/\//i.test(normalized)) return normalized;
  return null;
}
