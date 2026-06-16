import {
  buildSignedCloudflarePlaybackSource,
  buildSignedCloudflarePlaybackSources,
} from "@/lib/cloudflare-stream-signed-url";
import { isCloudflareStreamUrl } from "@/lib/cloudflare-stream";
import {
  resolveAllPlaybackSources,
  resolvePlaybackSources,
  type PlaybackSource,
  type PlaybackSourceSet,
} from "@/lib/playback-sources";
import { findStreamAssetBySourceUrl } from "@/lib/stream-asset-store";

const READY_STREAM_STATES = new Set(["ready", "live", "completed", "success"]);

function isReadyStreamState(status: string | null | undefined): boolean {
  if (!status) return false;
  return READY_STREAM_STATES.has(status.toLowerCase());
}

export type ServerPlaybackResolution = {
  playback: PlaybackSource | null;
  sources: PlaybackSourceSet | null;
  streamReady: boolean;
  streamStatus: string | null;
};

/**
 * Server-only source resolver. Uploaded files initially point at S3, then Stream
 * processing records an HLS URL in StreamAsset before webhooks update catalogue rows.
 */
export async function resolveServerPlaybackSource(
  videoUrl: string | null | undefined,
): Promise<PlaybackSource | null> {
  const resolved = await resolveServerPlaybackBundle(videoUrl);
  return resolved.playback;
}

export async function resolveServerPlaybackBundle(
  videoUrl: string | null | undefined,
): Promise<ServerPlaybackResolution> {
  const url = videoUrl?.trim();
  if (!url) {
    return { playback: null, sources: null, streamReady: false, streamStatus: null };
  }

  const signedSources = await buildSignedCloudflarePlaybackSources(url);
  if (signedSources) {
    return {
      playback: signedSources.primary,
      sources: signedSources,
      streamReady: true,
      streamStatus: "ready",
    };
  }

  const signedDirect = await buildSignedCloudflarePlaybackSource(url);
  if (signedDirect) {
    const sources = resolveAllPlaybackSources(url);
    return {
      playback: signedDirect,
      sources: sources
        ? { ...sources, primary: signedDirect, hls: signedDirect }
        : { primary: signedDirect, hls: signedDirect, dash: null, mp4: null },
      streamReady: true,
      streamStatus: "ready",
    };
  }

  if (!isCloudflareStreamUrl(url)) {
    const asset = await findStreamAssetBySourceUrl(url);
    const streamReady = isReadyStreamState(asset?.status);
    const streamUrl = streamReady ? asset?.hlsUrl ?? asset?.playbackUrl : null;

    if (streamUrl) {
      const signedAssetSources = await buildSignedCloudflarePlaybackSources(streamUrl);
      if (signedAssetSources) {
        return {
          playback: signedAssetSources.primary,
          sources: signedAssetSources,
          streamReady: true,
          streamStatus: asset?.status ?? "ready",
        };
      }

      const sources = resolveAllPlaybackSources(streamUrl);
      return {
        playback: sources?.primary ?? resolvePlaybackSources(streamUrl),
        sources,
        streamReady: true,
        streamStatus: asset?.status ?? "ready",
      };
    }

    if (asset && !streamReady) {
      return {
        playback: null,
        sources: null,
        streamReady: false,
        streamStatus: asset.status ?? "processing",
      };
    }
  }

  const sources = resolveAllPlaybackSources(url);
  const isStream = isCloudflareStreamUrl(url);

  return {
    playback: sources?.primary ?? resolvePlaybackSources(url),
    sources,
    streamReady: isStream || Boolean(sources?.hls),
    streamStatus: isStream ? "ready" : sources?.hls ? "ready" : null,
  };
}
