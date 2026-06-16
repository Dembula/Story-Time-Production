import { ingestToCloudflareStreamFromUrl } from "@/lib/cloudflare-stream";
import { upsertStreamAsset } from "@/lib/stream-asset-store";
import { getStorageConfig } from "@/lib/storage-config";
import { createContentMediaDownloadUrl } from "@/lib/content-media-s3";

export type ContentMediaFinalizePayload = {
  ok: true;
  bucket: string;
  path: string;
  publicUrl: string;
  sourceUrl: string;
  streamUid: string | null;
  streamStatus: string | null;
  streamPlaybackUrl: string | null;
  streamIframeUrl: string | null;
  streamHlsUrl: string | null;
};

function normalizePublicBaseUrl(bucket: string): string {
  const storage = getStorageConfig();
  const raw = storage.publicBaseUrl;
  const fallback = `https://${bucket}.s3.${storage.region}.amazonaws.com`;
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "");
  return `https://${raw.replace(/\/$/, "")}`;
}

/** Fast path: build S3 URLs only (no Stream ingest). */
export function buildContentMediaFinalizePayload(options: {
  key: string;
  contentType: string;
}): ContentMediaFinalizePayload {
  const storage = getStorageConfig();
  const bucket = storage.bucket;
  if (!bucket) {
    throw new Error("Storage bucket is not configured");
  }

  const baseUrl = normalizePublicBaseUrl(bucket);
  const sourceUrl = `${baseUrl}/${options.key.split("/").map(encodeURIComponent).join("/")}`;

  return {
    ok: true,
    bucket,
    path: options.key,
    publicUrl: sourceUrl,
    sourceUrl,
    streamUid: null,
    streamStatus: null,
    streamPlaybackUrl: null,
    streamIframeUrl: null,
    streamHlsUrl: null,
  };
}

/** Ingest a video from S3 into Cloudflare Stream (run in background via `after()`). */
export async function ingestVideoStreamForContentMedia(options: {
  sourceUrl: string;
  contentType: string;
  fileNameForMeta?: string;
  /** Object key — used to mint a presigned GET so Cloudflare can pull from private buckets. */
  key?: string;
}): Promise<void> {
  if (!options.contentType.startsWith("video/")) return;

  // Cloudflare downloads the master file from the URL we hand it. Prefer a presigned
  // GET (works for private buckets); fall back to the canonical public URL.
  const fetchableUrl = options.key
    ? (await createContentMediaDownloadUrl(options.key)) ?? options.sourceUrl
    : options.sourceUrl;

  try {
    const stream = await ingestToCloudflareStreamFromUrl(fetchableUrl, {
      source: "storytime-upload",
      fileName: options.fileNameForMeta ?? "video",
      mime: options.contentType,
    });
    await upsertStreamAsset({
      // Always store the canonical (non-expiring) URL so later lookups by
      // content.videoUrl resolve, even though we ingested via a presigned URL.
      uid: stream.uid,
      sourceUrl: options.sourceUrl,
      playbackUrl: stream.mp4Url,
      hlsUrl: stream.hlsUrl,
      iframeUrl: stream.iframeUrl,
      status: stream.state,
    });
  } catch (streamErr) {
    console.error("Cloudflare Stream ingestion failed; S3 URL remains available:", streamErr);
  }
}

/**
 * After the object exists in S3, build public URLs and optionally start Cloudflare Stream ingest for video.
 * @deprecated Prefer `buildContentMediaFinalizePayload` + background `ingestVideoStreamForContentMedia`.
 */
export async function finalizeContentMediaUpload(options: {
  key: string;
  contentType: string;
  fileNameForMeta?: string;
}): Promise<ContentMediaFinalizePayload> {
  const payload = buildContentMediaFinalizePayload(options);
  await ingestVideoStreamForContentMedia({
    sourceUrl: payload.sourceUrl,
    contentType: options.contentType,
    fileNameForMeta: options.fileNameForMeta ?? options.key.split("/").pop() ?? "video",
    key: options.key,
  });
  return payload;
}
