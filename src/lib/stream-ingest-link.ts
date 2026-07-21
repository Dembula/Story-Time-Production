import {
  extractCloudflareStreamUid,
  ingestToCloudflareStreamFromUrl,
  isCloudflareStreamUrl,
} from "@/lib/cloudflare-stream";
import { resolveContentTypeForUpload } from "@/lib/content-media-shared";
import { buildStreamIngestMeta } from "@/lib/stream-ingest-meta";
import { resolveIngestSourceUrlForCloudflare } from "@/lib/stream-ingest-source";
import {
  findStreamAssetBySourceUrl,
  findStreamAssetByUid,
  setStreamAssetEntity,
  upsertStreamAsset,
  deleteFailedStreamAssetsForSourceUrl,
  type StreamAssetPlaybackCandidate,
} from "@/lib/stream-asset-store";
import { isAllowedStorageUrl } from "@/lib/storage-origin";
import { normalizeStorageMediaUrl } from "@/lib/pack-storage-media-url";
import { isFailedStreamStatus, isReadyStreamStatus } from "@/lib/content-approve-publish";

const VIDEO_URL_RE = /\.(mp4|mov|webm|mkv|m4v|avi|mpeg|mpg|m2ts|3gp|hevc)(\?|$)/i;

export function resolveStreamPlaybackUrl(asset: StreamAssetPlaybackCandidate | null | undefined): string | null {
  if (!asset) return null;
  return asset.hlsUrl ?? asset.playbackUrl ?? asset.iframeUrl ?? null;
}

export function isLikelyVideoStorageUrl(url: string): boolean {
  return VIDEO_URL_RE.test(url) || isCloudflareStreamUrl(url) || url.startsWith("s3://");
}

function resolveIngestableHttpUrl(url: string): string | null {
  const normalized = normalizeStorageMediaUrl(url);
  if (!normalized) return null;
  if (!isAllowedStorageUrl(normalized) && !isCloudflareStreamUrl(normalized)) return null;
  return normalized;
}

function shouldReinjestExistingAsset(asset: StreamAssetPlaybackCandidate | null | undefined): boolean {
  if (!asset) return true;
  if (isReadyStreamStatus(asset.status)) return false;
  if (isFailedStreamStatus(asset.status)) return true;
  // Missing playback URLs after a long queued/processing state → try again.
  if (!asset.hlsUrl && !asset.playbackUrl) return true;
  return false;
}

async function ingestAndStore(options: {
  catalogueSourceUrl: string;
  ingestHttpUrl: string;
  meta?: Record<string, string>;
  entityType?: string;
  entityId?: string;
}): Promise<StreamAssetPlaybackCandidate | null> {
  const contentType = resolveContentTypeForUpload({
    name: options.catalogueSourceUrl.split("/").pop() ?? "video.mp4",
    type: "",
  });
  const signedOrPublic =
    (await resolveIngestSourceUrlForCloudflare(options.catalogueSourceUrl)) ?? options.ingestHttpUrl;

  await deleteFailedStreamAssetsForSourceUrl(options.catalogueSourceUrl);

  const stream = await ingestToCloudflareStreamFromUrl(
    signedOrPublic,
    buildStreamIngestMeta({
      ...options.meta,
      fileName: options.catalogueSourceUrl.split("/").pop() ?? "video.mp4",
      mime: contentType,
      entityType: options.entityType,
      entityId: options.entityId,
      source: options.meta?.source ?? "storytime-catalogue",
    }),
  );

  await upsertStreamAsset({
    uid: stream.uid,
    sourceUrl: options.catalogueSourceUrl,
    playbackUrl: stream.mp4Url,
    hlsUrl: stream.hlsUrl,
    iframeUrl: stream.iframeUrl,
    status: stream.state,
    entityType: options.entityType ?? null,
    entityId: options.entityId ?? null,
  });

  if (options.entityType && options.entityId) {
    await setStreamAssetEntity(stream.uid, options.entityType, options.entityId);
  }

  return {
    uid: stream.uid,
    sourceUrl: options.catalogueSourceUrl,
    status: stream.state,
    playbackUrl: stream.mp4Url,
    hlsUrl: stream.hlsUrl,
    iframeUrl: stream.iframeUrl,
  };
}

/** Queue Cloudflare Stream ingest for a video URL (no entity link). */
export async function ensureVideoIngested(
  url: string | null | undefined,
  meta?: Record<string, string>,
): Promise<void> {
  const trimmed = url?.trim();
  if (!trimmed || !isLikelyVideoStorageUrl(trimmed)) return;
  if (extractCloudflareStreamUid(trimmed)) return;

  const httpUrl = resolveIngestableHttpUrl(trimmed);
  if (!httpUrl || !isAllowedStorageUrl(httpUrl)) return;

  const existing =
    (await findStreamAssetBySourceUrl(httpUrl)) ?? (await findStreamAssetBySourceUrl(trimmed));
  if (existing && !shouldReinjestExistingAsset(existing)) return;

  try {
    await ingestAndStore({
      catalogueSourceUrl: httpUrl,
      ingestHttpUrl: httpUrl,
      meta: { ...meta, source: meta?.source ?? "storytime-recovery" },
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
  if (!trimmed || !isLikelyVideoStorageUrl(trimmed)) return null;
  const linkedEntityType =
    entityType === "Content" && meta?.area === "content-trailer" ? "ContentTrailer" : entityType;

  const existingUid = extractCloudflareStreamUid(trimmed);
  if (existingUid) {
    await setStreamAssetEntity(existingUid, linkedEntityType, entityId);
    return (await findStreamAssetByUid(existingUid)) ?? findStreamAssetBySourceUrl(trimmed);
  }

  if (isCloudflareStreamUrl(trimmed)) return findStreamAssetBySourceUrl(trimmed);

  const httpUrl = resolveIngestableHttpUrl(trimmed);
  if (!httpUrl || !isAllowedStorageUrl(httpUrl)) return null;

  const existingAsset =
    (await findStreamAssetBySourceUrl(httpUrl)) ?? (await findStreamAssetBySourceUrl(trimmed));

  if (existingAsset && !shouldReinjestExistingAsset(existingAsset)) {
    await setStreamAssetEntity(existingAsset.uid, linkedEntityType, entityId);
    return existingAsset;
  }

  try {
    return await ingestAndStore({
      catalogueSourceUrl: httpUrl,
      ingestHttpUrl: httpUrl,
      meta: { ...meta, source: meta?.source ?? "storytime-catalogue" },
      entityType: linkedEntityType,
      entityId,
    });
  } catch (streamErr) {
    console.error("Cloudflare Stream ingestion failed for linked URL:", streamErr);
    if (existingAsset) {
      await setStreamAssetEntity(existingAsset.uid, linkedEntityType, entityId);
      return existingAsset;
    }
    return null;
  }
}
