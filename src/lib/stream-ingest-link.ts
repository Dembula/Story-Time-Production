import {
  extractCloudflareStreamUid,
  ingestToCloudflareStreamFromUrl,
  isCloudflareStreamUrl,
} from "@/lib/cloudflare-stream";
import { resolveContentTypeForUpload } from "@/lib/content-media-shared";
import { findStreamAssetUidBySourceUrl, setStreamAssetEntity, upsertStreamAsset } from "@/lib/stream-asset-store";
import { isAllowedStorageUrl } from "@/lib/storage-origin";

const VIDEO_URL_RE = /\.(mp4|mov|webm|mkv|m4v|avi|mpeg|mpg|m2ts|3gp|hevc)(\?|$)/i;

export function isLikelyVideoStorageUrl(url: string): boolean {
  return VIDEO_URL_RE.test(url) || isCloudflareStreamUrl(url);
}

/** Queue Cloudflare Stream ingest for a video URL (no entity link). */
export async function ensureVideoIngested(
  url: string | null | undefined,
  meta?: Record<string, string>,
): Promise<void> {
  const trimmed = url?.trim();
  if (!trimmed || !isAllowedStorageUrl(trimmed) || !isLikelyVideoStorageUrl(trimmed)) return;
  if (extractCloudflareStreamUid(trimmed)) return;
  if (await findStreamAssetUidBySourceUrl(trimmed)) return;

  try {
    const contentType = resolveContentTypeForUpload({ name: trimmed.split("/").pop() ?? "video.mp4", type: "" });
    const stream = await ingestToCloudflareStreamFromUrl(trimmed, {
      ...meta,
      mime: contentType,
    });
    await upsertStreamAsset({
      uid: stream.uid,
      sourceUrl: trimmed,
      playbackUrl: stream.mp4Url,
      hlsUrl: stream.hlsUrl,
      iframeUrl: stream.iframeUrl,
      status: stream.state,
    });
  } catch (streamErr) {
    console.error("Background video ingest failed:", streamErr);
  }
}

/** Link an uploaded URL to Stream (ingest S3 sources in the background when needed). */
export async function linkOrIngestStreamForUrl(
  url: string | null | undefined,
  entityType: string,
  entityId: string,
  meta?: Record<string, string>,
): Promise<void> {
  const trimmed = url?.trim();
  if (!trimmed || !isAllowedStorageUrl(trimmed) || !isLikelyVideoStorageUrl(trimmed)) return;
  const linkedEntityType =
    entityType === "Content" && meta?.area === "content-trailer" ? "ContentTrailer" : entityType;

  const existingUid = extractCloudflareStreamUid(trimmed);
  if (existingUid) {
    await setStreamAssetEntity(existingUid, linkedEntityType, entityId);
    return;
  }

  if (isCloudflareStreamUrl(trimmed)) return;

  const uidFromStore = await findStreamAssetUidBySourceUrl(trimmed);
  if (uidFromStore) {
    await setStreamAssetEntity(uidFromStore, linkedEntityType, entityId);
    return;
  }

  try {
    const stream = await ingestToCloudflareStreamFromUrl(trimmed, meta);
    await upsertStreamAsset({
      uid: stream.uid,
      sourceUrl: trimmed,
      playbackUrl: stream.mp4Url,
      hlsUrl: stream.hlsUrl,
      iframeUrl: stream.iframeUrl,
      status: stream.state,
    });
    await setStreamAssetEntity(stream.uid, linkedEntityType, entityId);
  } catch (streamErr) {
    console.error("Cloudflare Stream ingestion failed for linked URL:", streamErr);
  }
}
