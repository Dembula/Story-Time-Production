import {
  extractCloudflareStreamUid,
  ingestToCloudflareStreamFromUrl,
  isCloudflareStreamUrl,
} from "@/lib/cloudflare-stream";
import { resolveContentTypeForUpload } from "@/lib/content-media-shared";
import { buildStreamIngestMeta } from "@/lib/stream-ingest-meta";
import {
  findStreamAssetBySourceUrl,
  findStreamAssetByUid,
  setStreamAssetEntity,
  upsertStreamAsset,
  type StreamAssetPlaybackCandidate,
} from "@/lib/stream-asset-store";
import { isAllowedStorageUrl } from "@/lib/storage-origin";

const VIDEO_URL_RE = /\.(mp4|mov|webm|mkv|m4v|avi|mpeg|mpg|m2ts|3gp|hevc)(\?|$)/i;

export function resolveStreamPlaybackUrl(asset: StreamAssetPlaybackCandidate | null | undefined): string | null {
  if (!asset) return null;
  return asset.hlsUrl ?? asset.playbackUrl ?? asset.iframeUrl ?? null;
}

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
  if (await findStreamAssetBySourceUrl(trimmed)) return;

  try {
    const contentType = resolveContentTypeForUpload({ name: trimmed.split("/").pop() ?? "video.mp4", type: "" });
    const stream = await ingestToCloudflareStreamFromUrl(
      trimmed,
      buildStreamIngestMeta({
        ...meta,
        fileName: trimmed.split("/").pop() ?? "video.mp4",
        mime: contentType,
        source: meta?.source ?? "storytime-recovery",
      }),
    );
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
): Promise<StreamAssetPlaybackCandidate | null> {
  const trimmed = url?.trim();
  if (!trimmed || !isAllowedStorageUrl(trimmed) || !isLikelyVideoStorageUrl(trimmed)) return null;
  const linkedEntityType =
    entityType === "Content" && meta?.area === "content-trailer" ? "ContentTrailer" : entityType;

  const existingUid = extractCloudflareStreamUid(trimmed);
  if (existingUid) {
    await setStreamAssetEntity(existingUid, linkedEntityType, entityId);
    return (await findStreamAssetByUid(existingUid)) ?? findStreamAssetBySourceUrl(trimmed);
  }

  if (isCloudflareStreamUrl(trimmed)) return findStreamAssetBySourceUrl(trimmed);

  const existingAsset = await findStreamAssetBySourceUrl(trimmed);
  if (existingAsset) {
    await setStreamAssetEntity(existingAsset.uid, linkedEntityType, entityId);
    return existingAsset;
  }

  try {
    const stream = await ingestToCloudflareStreamFromUrl(
      trimmed,
      buildStreamIngestMeta({
        ...meta,
        entityType: linkedEntityType,
        entityId,
        source: meta?.source ?? "storytime-catalogue",
      }),
    );
    await upsertStreamAsset({
      uid: stream.uid,
      sourceUrl: trimmed,
      playbackUrl: stream.mp4Url,
      hlsUrl: stream.hlsUrl,
      iframeUrl: stream.iframeUrl,
      status: stream.state,
      entityType: linkedEntityType,
      entityId,
    });
    await setStreamAssetEntity(stream.uid, linkedEntityType, entityId);
    return {
      uid: stream.uid,
      sourceUrl: trimmed,
      status: stream.state,
      playbackUrl: stream.mp4Url,
      hlsUrl: stream.hlsUrl,
      iframeUrl: stream.iframeUrl,
    };
  } catch (streamErr) {
    console.error("Cloudflare Stream ingestion failed for linked URL:", streamErr);
    return null;
  }
}
