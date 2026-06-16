import {
  buildSignedCloudflarePlaybackSource,
  isCloudflareSignedPlaybackEnabled,
} from "@/lib/cloudflare-stream-signed-url";
import { extractCloudflareStreamUid, isCloudflareStreamUrl } from "@/lib/cloudflare-stream";
import { resolvePlaybackSources, type PlaybackSource } from "@/lib/playback-sources";
import {
  findStreamAssetBySourceUrl,
  findStreamAssetByUid,
} from "@/lib/stream-asset-store";

const READY_STREAM_STATES = new Set(["ready", "live", "completed", "success"]);

function isReadyStreamState(status: string | null | undefined): boolean {
  if (!status) return false;
  return READY_STREAM_STATES.has(status.toLowerCase());
}

function isS3OrMp4Url(url: string): boolean {
  return /\.mp4(\?|$)/i.test(url) || /amazonaws\.com|cloudfront\.net|r2\.cloudflarestorage\.com/i.test(url);
}

async function resolveS3FallbackFromStreamUrl(
  streamUrl: string,
): Promise<PlaybackSource | null> {
  const uid = extractCloudflareStreamUid(streamUrl);
  if (!uid) return null;

  const asset = await findStreamAssetByUid(uid);
  const sourceUrl = asset?.sourceUrl?.trim();
  if (!sourceUrl || isCloudflareStreamUrl(sourceUrl)) return null;
  return resolvePlaybackSources(sourceUrl);
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

  const signedRequired = isCloudflareSignedPlaybackEnabled();

  const signedDirect = await buildSignedCloudflarePlaybackSource(url);
  if (signedDirect) return signedDirect;

  if (isCloudflareStreamUrl(url) || extractCloudflareStreamUid(url)) {
    if (signedRequired) {
      const s3Fallback = await resolveS3FallbackFromStreamUrl(url);
      if (s3Fallback) return s3Fallback;
      return null;
    }
    return resolvePlaybackSources(url);
  }

  const asset = await findStreamAssetBySourceUrl(url);
  const streamUrl = isReadyStreamState(asset?.status)
    ? asset?.hlsUrl ?? asset?.playbackUrl
    : null;
  if (streamUrl) {
    const signedAsset = await buildSignedCloudflarePlaybackSource(streamUrl);
    if (signedAsset) return signedAsset;
    if (signedRequired) {
      if (isS3OrMp4Url(url)) return resolvePlaybackSources(url);
      return null;
    }
    return resolvePlaybackSources(streamUrl);
  }

  return resolvePlaybackSources(url);
}

export function isS3FallbackPlayback(source: PlaybackSource | null): boolean {
  return source?.type === "video/mp4";
}
