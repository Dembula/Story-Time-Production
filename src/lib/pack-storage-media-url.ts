import { getStorageConfig } from "@/lib/storage-config";
import { isCloudflareStreamUrl } from "@/lib/cloudflare-stream";
import {
  parseStorageRef,
  resolveStorageObjectRef,
  type StorageObjectRef,
} from "@/lib/storage-object-ref";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * True only when an explicit public CDN / bucket base is configured
 * (`STORAGE_PUBLIC_BASE_URL` / `S3_PUBLIC_BASE_URL`).
 * Do NOT treat the inferred private `bucket.s3.region.amazonaws.com` host as public —
 * those objects 403 in the browser and burn Image Optimization on failed fetches.
 */
export function hasConfiguredPublicStorageBase(): boolean {
  return Boolean(getStorageConfig().publicBaseUrl?.trim());
}

/**
 * HTTPS public base for packaging `s3://` refs.
 * Prefer a configured CDN; fall back to the regional S3 virtual-host URL only for
 * non-browser use (e.g. Stream ingest lookups). Browsers must not use the fallback
 * unless the bucket is actually public.
 */
export function getStoragePublicBaseUrl(bucket?: string): string | null {
  const storage = getStorageConfig();
  const targetBucket = bucket || storage.bucket;
  if (!targetBucket) return null;

  const raw = storage.publicBaseUrl?.trim();
  if (raw) {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return trimTrailingSlash(withProtocol);
  }

  if (storage.region) {
    return `https://${targetBucket}.s3.${storage.region}.amazonaws.com`;
  }

  return null;
}

/** Browser-safe public HTTPS URL — only when a real public base is configured. */
export function buildConfiguredPublicStorageUrl(ref: StorageObjectRef): string | null {
  if (!hasConfiguredPublicStorageBase()) return null;
  return buildHttpsStorageUrl(ref);
}

/** Build a browser/Stream-reachable HTTPS object URL for a bucket key. */
export function buildHttpsStorageUrl(ref: StorageObjectRef): string | null {
  const base = getStoragePublicBaseUrl(ref.bucket);
  if (!base) return null;
  const encodedKey = ref.key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${base}/${encodedKey}`;
}

/**
 * Convert `s3://…` (or already-https storage URLs) into a browser-reachable HTTPS URL.
 * Returns null for empty / unrecognized values. Cloudflare Stream URLs pass through unchanged.
 */
export function packBrowserMediaUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("s3://")) {
    const ref = parseStorageRef(trimmed) ?? resolveStorageObjectRef(trimmed);
    if (!ref) return null;
    return buildHttpsStorageUrl(ref);
  }

  return null;
}

/**
 * Normalize a stored catalogue media value to the HTTPS source URL Stream / S3 clients expect.
 * Prefer packaging `s3://` → public HTTPS so lookups match StreamAsset.sourceUrl from upload.
 */
export function normalizeStorageMediaUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (isCloudflareStreamUrl(trimmed) || /videodelivery\.net|cloudflarestream\.com/i.test(trimmed)) {
    return trimmed;
  }
  return packBrowserMediaUrl(trimmed) ?? trimmed;
}

/** All equivalent keys we may have stored for the same object (s3 ref + https forms). */
export function storageMediaLookupKeys(value: string | null | undefined): string[] {
  const trimmed = value?.trim();
  if (!trimmed) return [];

  const keys = new Set<string>([trimmed]);
  const packed = packBrowserMediaUrl(trimmed);
  if (packed) keys.add(packed);

  const ref = resolveStorageObjectRef(trimmed) ?? (trimmed.startsWith("s3://") ? parseStorageRef(trimmed) : null);
  if (ref) {
    keys.add(`s3://${ref.bucket}/${ref.key}`);
    const https = buildHttpsStorageUrl(ref);
    if (https) keys.add(https);
  }

  return [...keys];
}
