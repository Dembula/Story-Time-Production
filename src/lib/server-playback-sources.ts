import { buildSignedCloudflarePlaybackSources } from "@/lib/cloudflare-stream-signed-url";
import { isCloudflareStreamUrl } from "@/lib/cloudflare-stream";
import {
  resolvePlaybackSourceSet,
  resolvePlaybackSources,
  type PlaybackSource,
} from "@/lib/playback-sources";
import { findStreamAssetBySourceUrl } from "@/lib/stream-asset-store";

const READY_STREAM_STATES = new Set(["ready", "live", "completed", "success"]);

function isReadyStreamState(status: string | null | undefined): boolean {
  if (!status) return false;
  return READY_STREAM_STATES.has(status.toLowerCase());
}

export type ServerPlaybackPlan = {
  playback: PlaybackSource | null;
  sources: PlaybackSource[];
  sourceOrigin: "signed-stream" | "stream-asset" | "direct";
  streamState: "ready" | "processing" | "untracked";
};

function dedupeSources(sources: PlaybackSource[]): PlaybackSource[] {
  const seen = new Set<string>();
  const deduped: PlaybackSource[] = [];
  for (const source of sources) {
    const key = `${source.type}::${source.src}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(source);
  }
  return deduped;
}

export async function resolveServerPlaybackPlan(
  videoUrl: string | null | undefined,
): Promise<ServerPlaybackPlan> {
  const url = videoUrl?.trim();
  if (!url) {
    return {
      playback: null,
      sources: [],
      sourceOrigin: "direct",
      streamState: "untracked",
    };
  }

  const signedDirect = await buildSignedCloudflarePlaybackSources(url);
  if (signedDirect.length > 0) {
    return {
      playback: signedDirect[0] ?? null,
      sources: dedupeSources(signedDirect),
      sourceOrigin: "signed-stream",
      streamState: "ready",
    };
  }

  if (!isCloudflareStreamUrl(url)) {
    const asset = await findStreamAssetBySourceUrl(url);
    const streamReady = isReadyStreamState(asset?.status);
    const streamUrl = streamReady ? asset?.hlsUrl ?? asset?.playbackUrl : null;
    if (streamUrl) {
      const signedAsset = await buildSignedCloudflarePlaybackSources(streamUrl);
      if (signedAsset.length > 0) {
        return {
          playback: signedAsset[0] ?? null,
          sources: dedupeSources(signedAsset),
          sourceOrigin: "signed-stream",
          streamState: "ready",
        };
      }
      const streamSources = resolvePlaybackSourceSet(streamUrl);
      return {
        playback: streamSources[0] ?? null,
        sources: dedupeSources(streamSources),
        sourceOrigin: "stream-asset",
        streamState: "ready",
      };
    }

    const direct = resolvePlaybackSourceSet(url);
    return {
      playback: direct[0] ?? null,
      sources: dedupeSources(direct),
      sourceOrigin: "direct",
      streamState: asset ? "processing" : "untracked",
    };
  }

  const direct = resolvePlaybackSourceSet(url);
  return {
    playback: direct[0] ?? null,
    sources: dedupeSources(direct),
    sourceOrigin: "direct",
    streamState: "ready",
  };
}

/**
 * Server-only source resolver. Uploaded files initially point at S3, then Stream
 * processing records an HLS URL in StreamAsset before webhooks update catalogue rows.
 */
export async function resolveServerPlaybackSource(
  videoUrl: string | null | undefined,
): Promise<PlaybackSource | null> {
  const plan = await resolveServerPlaybackPlan(videoUrl);
  if (plan.playback) return plan.playback;
  return resolvePlaybackSources(videoUrl);
}
