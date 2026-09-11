import { getStorageConfig } from "@/lib/storage-config";
import type { StorageObjectRef } from "@/lib/storage-object-ref";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"]);

/** Catalogue poster/backdrop keys live under uploads/ (and legacy content/). */
export function isCatalogueImageKey(key: string): boolean {
  const normalized = key.replace(/^\/+/, "");
  if (!normalized) return false;
  const ext = normalized.split(".").pop()?.toLowerCase() ?? "";
  if (!IMAGE_EXT.has(ext)) return false;
  return (
    normalized.startsWith("uploads/") ||
    normalized.startsWith("content/") ||
    normalized.startsWith("posters/") ||
    normalized.startsWith("backdrops/") ||
    normalized.startsWith("covers/")
  );
}

export function isAllowedCatalogueBucket(bucket: string): boolean {
  const configured = getStorageConfig().bucket;
  if (!configured) return false;
  return bucket === configured;
}

/**
 * Stable same-origin URL for catalogue art.
 * Next/Vercel Image Optimization can cache this path forever for a given object key
 * (unlike hour-rotating S3 signed URLs).
 */
export function buildCatalogueMediaProxyUrl(ref: StorageObjectRef): string {
  const keyPath = ref.key
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/api/media/catalogue/${encodeURIComponent(ref.bucket)}/${keyPath}`;
}

export function parseCatalogueMediaProxyPath(
  bucketParam: string,
  keyParts: string[],
): StorageObjectRef | null {
  const bucket = decodeURIComponent(bucketParam || "").trim();
  if (!bucket || keyParts.length === 0) return null;
  const key = keyParts.map((part) => decodeURIComponent(part)).join("/");
  if (!key || !isAllowedCatalogueBucket(bucket) || !isCatalogueImageKey(key)) return null;
  return { bucket, key };
}
