import {
  buildSignedCloudflarePlaybackSource,
  isCloudflareSignedPlaybackEnabled,
} from "@/lib/cloudflare-stream-signed-url";
import { extractCloudflareStreamUid, isCloudflareStreamUrl } from "@/lib/cloudflare-stream";
import { resolvePlaybackSources, type PlaybackSource } from "@/lib/playback-sources";
import { findStreamAssetBySourceUrl } from "@/lib/stream-asset-store";
import { createDownloadUrlForStorageUrl } from "@/lib/content-media-s3";

const READY_STREAM_STATES = new Set(["ready", "live", "completed", "success"]);

function isReadyStreamState(status: string | null | undefined): boolean {
  if (!status) return false;
  return READY_STREAM_STATES.has(status.toLowerCase());
}

export type ResolvedPlayback = {
  /** Source the player should load, or null when nothing is playable yet. */
  source: PlaybackSource | null;
  /** True when the asset is still transcoding and no adaptive source exists yet. */
  processing: boolean;
  /** Cloudflare Stream uid when known (used for on-demand reconciliation). */
  streamUid: string | null;
  /** Latest known Stream processing status. */
  status: string | null;
};

/**
 * Build a direct-from-storage fallback so the play button still works the moment a
 * film is uploaded — before adaptive HLS finishes transcoding. Uses a presigned GET
 * so it works with private buckets. Suppressed when signed/DRM playback is enforced
 * (we never serve a cleartext master in that mode).
 */
async function buildStorageFallbackSource(url: string): Promise<PlaybackSource | null> {
  if (isCloudflareSignedPlaybackEnabled()) return null;
  try {
    const playable = await createDownloadUrlForStorageUrl(url);
    return resolvePlaybackSources(playable);
  } catch {
    return null;
  }
}

/**
 * Server-only source resolver with processing awareness.
 *
 * Resolution order, mirroring how Netflix/Prime pick a playable rendition:
 *   1. Signed Cloudflare Stream URL (when signed playback is enabled).
 *   2. A URL that is already a Cloudflare Stream manifest.
 *   3. An uploaded file linked to a Stream asset — use Stream HLS when ready,
 *      otherwise mark as processing and offer a direct fallback when allowed.
 *   4. Any other storage URL — presigned direct playback.
 */
export async function resolveServerPlayback(
  videoUrl: string | null | undefined,
): Promise<ResolvedPlayback> {
  const url = videoUrl?.trim();
  if (!url) {
    return { source: null, processing: false, streamUid: null, status: null };
  }

  const signedDirect = await buildSignedCloudflarePlaybackSource(url);
  if (signedDirect) {
    return {
      source: signedDirect,
      processing: false,
      streamUid: extractCloudflareStreamUid(url),
      status: "ready",
    };
  }

  if (isCloudflareStreamUrl(url)) {
    return {
      source: resolvePlaybackSources(url),
      processing: false,
      streamUid: extractCloudflareStreamUid(url),
      status: "ready",
    };
  }

  const asset = await findStreamAssetBySourceUrl(url);
  if (asset) {
    if (isReadyStreamState(asset.status)) {
      const streamUrl = asset.hlsUrl ?? asset.playbackUrl;
      if (streamUrl) {
        const signedAsset = await buildSignedCloudflarePlaybackSource(streamUrl);
        return {
          source: signedAsset ?? resolvePlaybackSources(streamUrl),
          processing: false,
          streamUid: asset.uid,
          status: asset.status,
        };
      }
    }

    // Linked but still transcoding — keep the experience instant with a fallback.
    const fallback = await buildStorageFallbackSource(url);
    return {
      source: fallback,
      processing: !fallback,
      streamUid: asset.uid,
      status: asset.status,
    };
  }

  // Unknown to Stream — serve the uploaded file directly (presigned when private).
  const fallback = await buildStorageFallbackSource(url);
  return {
    source: fallback ?? resolvePlaybackSources(url),
    processing: false,
    streamUid: null,
    status: null,
  };
}

/**
 * Back-compat wrapper returning just the source.
 * @deprecated Prefer {@link resolveServerPlayback} for processing awareness.
 */
export async function resolveServerPlaybackSource(
  videoUrl: string | null | undefined,
): Promise<PlaybackSource | null> {
  const resolved = await resolveServerPlayback(videoUrl);
  return resolved.source;
}
