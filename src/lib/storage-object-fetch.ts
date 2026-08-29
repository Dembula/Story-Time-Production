import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createContentMediaS3Client } from "@/lib/content-media-s3";
import { guessMimeTypeFromKey, type StorageObjectRef } from "@/lib/storage-object-ref";

export type StorageObjectStreamResult = {
  body: NonNullable<import("@aws-sdk/client-s3").GetObjectCommandOutput["Body"]>;
  contentType: string;
  contentLength: number | null;
  contentRange: string | null;
  acceptRanges: string;
  /** Full object size when known (even for partial reads). */
  totalSize: number | null;
  statusCode: 200 | 206;
};

/** Parse a single `bytes=start-end` Range header. Returns null if absent/unusable. */
export function parseBytesRangeHeader(
  rangeHeader: string | null | undefined,
  totalSize: number,
): { start: number; end: number } | null {
  if (!rangeHeader?.trim() || totalSize <= 0) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;
  const startRaw = match[1];
  const endRaw = match[2];
  if (!startRaw && !endRaw) return null;

  let start: number;
  let end: number;
  if (!startRaw) {
    // suffix: bytes=-N
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else {
    start = Number(startRaw);
    end = endRaw ? Number(endRaw) : totalSize - 1;
    if (!Number.isFinite(start) || start < 0) return null;
    if (!Number.isFinite(end) || end < start) end = totalSize - 1;
    end = Math.min(end, totalSize - 1);
  }
  if (start >= totalSize) return null;
  return { start, end };
}

export async function getStorageObjectHead(ref: StorageObjectRef) {
  const { client } = createContentMediaS3Client();
  const response = await client.send(
    new HeadObjectCommand({
      Bucket: ref.bucket,
      Key: ref.key,
    }),
  );
  return {
    contentType: response.ContentType || guessMimeTypeFromKey(ref.key),
    contentLength: response.ContentLength ?? null,
  };
}

export async function getStorageObjectStream(
  ref: StorageObjectRef,
  options?: { rangeHeader?: string | null },
): Promise<StorageObjectStreamResult> {
  const { client } = createContentMediaS3Client();

  let totalSize: number | null = null;
  let contentTypeHint: string | null = null;
  const wantsRange = Boolean(options?.rangeHeader?.trim());

  if (wantsRange) {
    try {
      const head = await getStorageObjectHead(ref);
      totalSize = head.contentLength;
      contentTypeHint = head.contentType;
    } catch {
      // Fall through to full GetObject if HEAD fails.
    }
  }

  const parsed =
    wantsRange && totalSize != null
      ? parseBytesRangeHeader(options?.rangeHeader, totalSize)
      : null;

  const response = await client.send(
    new GetObjectCommand({
      Bucket: ref.bucket,
      Key: ref.key,
      ...(parsed ? { Range: `bytes=${parsed.start}-${parsed.end}` } : {}),
    }),
  );
  if (!response.Body) {
    throw new Error("Empty object body");
  }

  const contentLength = response.ContentLength ?? null;
  if (totalSize == null && !parsed) {
    totalSize = contentLength;
  }

  return {
    body: response.Body,
    contentType: response.ContentType || contentTypeHint || guessMimeTypeFromKey(ref.key),
    contentLength,
    contentRange: response.ContentRange ?? (parsed && totalSize != null
      ? `bytes ${parsed.start}-${parsed.end}/${totalSize}`
      : null),
    acceptRanges: "bytes",
    totalSize,
    statusCode: parsed ? 206 : 200,
  };
}

export async function getStorageObjectSignedUrl(ref: StorageObjectRef, expiresInSeconds = 300) {
  const { client } = createContentMediaS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: ref.bucket,
      Key: ref.key,
    }),
    { expiresIn: expiresInSeconds },
  );
}
