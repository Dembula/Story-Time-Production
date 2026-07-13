import {
  buildSignedCloudflarePlaybackSource,
  requiresSignedStreamPlayback,
} from "@/lib/cloudflare-stream-signed-url";
import { extractCloudflareStreamUid, isCloudflareStreamUrl } from "@/lib/cloudflare-stream";
import { resolvePlaybackSources, type PlaybackSource } from "@/lib/playback-sources";
import {
  findStreamAssetBySourceUrl,
  findStreamAssetByUid,
} from "@/lib/stream-asset-store";
import { normalizeStorageMediaUrl, packBrowserMediaUrl } from "@/lib/pack-storage-media-url";
import { resolveStorageObjectRef } from "@/lib/storage-object-ref";
import { getStorageObjectSignedUrl } from "@/lib/storage-object-fetch";

const READY_STREAM_STATES = new Set(["ready", "live", "completed", "success"]);

function isReadyStreamState(status: string | null | undefined): boolean {
  if (!status) return false;
  return READY_STREAM_STATES.has(status.toLowerCase());
}

function isS3OrMp4Url(url: string): boolean {
  return (
    url.startsWith("s3://") ||
    /\.mp4(\?|$)/i.test(url) ||
    /amazonaws\.com|cloudfront\.net|r2\.cloudflarestorage\.com/i.test(url)
  );
}

async function resolveS3FallbackFromStreamUrl(
  streamUrl: string,
): Promise<PlaybackSource | null> {
  const uid = extractCloudflareStreamUid(streamUrl);
  if (!uid) return null;

  const asset = await findStreamAssetByUid(uid);
  const sourceUrl = asset?.sourceUrl?.trim();
  if (!sourceUrl || isCloudflareStreamUrl(sourceUrl)) return null;
  return resolvePlayableMp4Source(sourceUrl);
}

async function resolvePlayableMp4Source(url: string): Promise<PlaybackSource | null> {
  const httpUrl = packBrowserMediaUrl(url) ?? (url.startsWith("http") ? url : null);
  if (!httpUrl) return null;

  // Prefer short-lived signed GET when the object is platform storage (private buckets).
  const ref = resolveStorageObjectRef(url) ?? resolveStorageObjectRef(httpUrl);
  if (ref) {
    try {
      const signed = await getStorageObjectSignedUrl(ref, 60 * 60);
      return { src: signed, type: "video/mp4" };
    } catch (err) {
      console.error("Signed S3 playback URL failed; falling back to public URL:", err);
    }
  }

  return resolvePlaybackSources(httpUrl);
}

async function resolveStreamPlaybackSource(
  streamUrl: string,
): Promise<PlaybackSource | null> {
  const signed = await buildSignedCloudflarePlaybackSource(streamUrl);
  if (signed) return signed;

  if (requiresSignedStreamPlayback()) {
    const s3Fallback = await resolveS3FallbackFromStreamUrl(streamUrl);
    if (s3Fallback) return s3Fallback;
    return null;
  }

  return resolvePlaybackSources(streamUrl);
}

/**
 * Server-only source resolver. Uploaded files initially point at S3, then Stream
 * processing records an HLS URL in StreamAsset before webhooks update catalogue rows.
 */
export async function resolveServerPlaybackSource(
  videoUrl: string | null | undefined,
): Promise<PlaybackSource | null> {
  const url = videoUrl?.trim();
  if (!url) return null;

  if (isCloudflareStreamUrl(url) || extractCloudflareStreamUid(url)) {
    return resolveStreamPlaybackSource(url);
  }

  const normalized = normalizeStorageMediaUrl(url) ?? url;
  const asset =
    (await findStreamAssetBySourceUrl(normalized)) ?? (await findStreamAssetBySourceUrl(url));
  const streamUrl = isReadyStreamState(asset?.status)
    ? asset?.hlsUrl ?? asset?.playbackUrl
    : null;
  if (streamUrl) {
    const streamPlayback = await resolveStreamPlaybackSource(streamUrl);
    if (streamPlayback) return streamPlayback;
    if (requiresSignedStreamPlayback()) {
      if (isS3OrMp4Url(url) || isS3OrMp4Url(normalized)) {
        return resolvePlayableMp4Source(normalized);
      }
      return null;
    }
  }

  if (isS3OrMp4Url(url) || isS3OrMp4Url(normalized)) {
    return resolvePlayableMp4Source(normalized);
  }

  return resolvePlaybackSources(normalized);
}

export function isS3FallbackPlayback(source: PlaybackSource | null): boolean {
  return source?.type === "video/mp4";
}
