import { extractCloudflareStreamUid } from "@/lib/cloudflare-stream";
import type { StreamAssetPlaybackCandidate } from "@/lib/stream-asset-store";
import { syncLinkedEntitiesAfterStreamReady } from "@/lib/stream-entity-sync";

const READY_STREAM_STATES = new Set(["ready", "live", "completed", "success"]);
const FAILED_STREAM_STATES = new Set(["error", "failed"]);

export function isReadyStreamStatus(status: string | null | undefined): boolean {
  return Boolean(status && READY_STREAM_STATES.has(status.toLowerCase()));
}

export function isFailedStreamStatus(status: string | null | undefined): boolean {
  return Boolean(status && FAILED_STREAM_STATES.has(status.toLowerCase()));
}

export function pickStreamHlsUrl(
  asset: StreamAssetPlaybackCandidate | undefined,
): string | null {
  if (!asset || !isReadyStreamStatus(asset.status)) return null;
  const hls = asset.hlsUrl?.trim();
  if (hls) return hls;
  const uid =
    extractCloudflareStreamUid(asset.playbackUrl ?? "") ??
    extractCloudflareStreamUid(asset.sourceUrl ?? "");
  if (uid) return `https://videodelivery.net/${uid}/manifest/video.m3u8`;
  return null;
}

export function buildApprovedPlaybackUrls(input: {
  videoUrl: string | null;
  trailerUrl: string | null;
  episodeRows: Array<{ id: string; videoUrl: string | null }>;
  streamAssets: Map<string, StreamAssetPlaybackCandidate>;
}): {
  videoUrl?: string;
  trailerUrl?: string;
  episodeUrls: Array<{ id: string; videoUrl: string }>;
} {
  const episodeUrls: Array<{ id: string; videoUrl: string }> = [];
  const videoUrl = input.videoUrl?.trim();
  const trailerUrl = input.trailerUrl?.trim();

  const nextVideo = videoUrl ? pickStreamHlsUrl(input.streamAssets.get(videoUrl)) : null;
  const nextTrailer = trailerUrl ? pickStreamHlsUrl(input.streamAssets.get(trailerUrl)) : null;

  for (const episode of input.episodeRows) {
    const url = episode.videoUrl?.trim();
    if (!url) continue;
    const hls = pickStreamHlsUrl(input.streamAssets.get(url));
    if (hls && hls !== url) {
      episodeUrls.push({ id: episode.id, videoUrl: hls });
    }
  }

  return {
    ...(nextVideo && nextVideo !== videoUrl ? { videoUrl: nextVideo } : {}),
    ...(nextTrailer && nextTrailer !== trailerUrl ? { trailerUrl: nextTrailer } : {}),
    episodeUrls,
  };
}

export async function syncReadyStreamsForContent(streamAssets: Map<string, StreamAssetPlaybackCandidate>) {
  const uids = new Set<string>();
  for (const asset of streamAssets.values()) {
    if (!isReadyStreamStatus(asset.status)) continue;
    const uid = asset.uid?.trim() || extractCloudflareStreamUid(asset.hlsUrl ?? asset.playbackUrl ?? "");
    if (uid) uids.add(uid);
  }
  for (const uid of uids) {
    try {
      await syncLinkedEntitiesAfterStreamReady(uid, "ready");
    } catch (err) {
      console.error("sync linked stream entities on approve failed:", uid, err);
    }
  }
}

export function toApproveResponse(content: {
  id: string;
  title: string;
  reviewStatus: string;
  published: boolean;
  featured: boolean;
  videoUrl: string | null;
  trailerUrl: string | null;
  reviewedAt: Date | null;
}) {
  return {
    id: content.id,
    title: content.title,
    reviewStatus: content.reviewStatus,
    published: content.published,
    featured: content.featured,
    videoUrl: content.videoUrl,
    trailerUrl: content.trailerUrl,
    reviewedAt: content.reviewedAt?.toISOString() ?? null,
  };
}
