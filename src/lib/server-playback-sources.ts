import { buildSignedCloudflarePlaybackSource } from "@/lib/cloudflare-stream-signed-url";
import { isCloudflareStreamUrl } from "@/lib/cloudflare-stream";
import { resolvePlaybackSources, type PlaybackSource } from "@/lib/playback-sources";
import { findStreamAssetBySourceUrl } from "@/lib/stream-asset-store";

const READY_STREAM_STATES = new Set(["ready", "live", "completed", "success"]);

function isReadyStreamState(status: string | null | undefined): boolean {
  if (!status) return false;
  return READY_STREAM_STATES.has(status.toLowerCase());
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

  const signedDirect = await buildSignedCloudflarePlaybackSource(url);
  if (signedDirect) return signedDirect;

  if (!isCloudflareStreamUrl(url)) {
    const asset = await findStreamAssetBySourceUrl(url);
    const streamUrl = isReadyStreamState(asset?.status)
      ? asset?.hlsUrl ?? asset?.playbackUrl
      : null;
    if (streamUrl) {
      const signedAsset = await buildSignedCloudflarePlaybackSource(streamUrl);
      if (signedAsset) return signedAsset;
      return resolvePlaybackSources(streamUrl);
    }
  }

  return resolvePlaybackSources(url);
}

export function isS3FallbackPlayback(source: PlaybackSource | null): boolean {
  return source?.type === "video/mp4";
}
