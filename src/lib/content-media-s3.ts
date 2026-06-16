import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageConfig } from "@/lib/storage-config";
import { getAllowedStorageBaseUrls } from "@/lib/storage-origin";

export function createContentMediaS3Client(): {
  client: S3Client;
  storage: ReturnType<typeof getStorageConfig>;
} {
  const storage = getStorageConfig();
  const client = new S3Client({
    region: storage.region || undefined,
    endpoint: storage.endpoint || undefined,
    credentials:
      storage.accessKeyId && storage.secretAccessKey
        ? {
            accessKeyId: storage.accessKeyId,
            secretAccessKey: storage.secretAccessKey,
          }
        : undefined,
    forcePathStyle: Boolean(storage.endpoint),
  });
  return { client, storage };
}

/**
 * Build a short-lived presigned GET URL for an uploaded object.
 *
 * Cloudflare Stream's `copy` endpoint and the in-browser fallback player both need
 * to *download* the source. Uploaded objects are stored privately (the presign for
 * PUT never sets a public ACL), so a public S3 URL would 403. A presigned GET lets
 * Cloudflare pull the master file even from a fully private bucket — this is the
 * difference between "upload succeeds but never becomes playable" and a working
 * transcode → playback pipeline.
 *
 * Returns `null` when credentials are missing (callers fall back to the public URL).
 */
export async function createContentMediaDownloadUrl(
  key: string,
  expiresInSeconds = 6 * 60 * 60,
): Promise<string | null> {
  const trimmedKey = key.trim();
  if (!trimmedKey) return null;
  const { client, storage } = createContentMediaS3Client();
  if (!storage.bucket || !storage.accessKeyId || !storage.secretAccessKey) {
    return null;
  }
  try {
    const command = new GetObjectCommand({ Bucket: storage.bucket, Key: trimmedKey });
    return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  } catch (err) {
    console.error("Failed to presign content media download URL:", err);
    return null;
  }
}

/**
 * Derive the S3 object key from a stored public/storage URL that belongs to this
 * platform's bucket (matches one of the allowed storage base URLs).
 */
export function deriveStorageObjectKey(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;
  const normalized = value.replace(/\/+$/, "");
  for (const base of getAllowedStorageBaseUrls()) {
    const prefix = `${base.replace(/\/+$/, "")}/`;
    if (normalized.startsWith(prefix)) {
      const rawKey = value.slice(prefix.length).split("?")[0];
      if (!rawKey) return null;
      try {
        return rawKey
          .split("/")
          .map((segment) => decodeURIComponent(segment))
          .join("/");
      } catch {
        return rawKey;
      }
    }
  }
  return null;
}

/**
 * Build a download URL Cloudflare (or a fallback player) can fetch from a stored
 * storage URL. Returns a presigned GET when the URL maps to our bucket and we hold
 * credentials; otherwise returns the original URL (assumed already fetchable).
 */
export async function createDownloadUrlForStorageUrl(
  url: string,
  expiresInSeconds = 6 * 60 * 60,
): Promise<string> {
  const key = deriveStorageObjectKey(url);
  if (!key) return url;
  const signed = await createContentMediaDownloadUrl(key, expiresInSeconds);
  return signed ?? url;
}
