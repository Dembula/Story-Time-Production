import { getDisplayPosterUrl, getStreamThumbnailGifUrl, getStreamThumbnailUrl } from "@/lib/content-media-urls";

export type ThumbnailCandidate = {
  url: string;
  score: number;
  source: "poster" | "stream-still" | "stream-gif" | "backdrop";
};

/** Rank artwork candidates for engagement (scene stills scored higher when provided). */
export function rankThumbnailCandidates(item: {
  posterUrl?: string | null;
  backdropUrl?: string | null;
  videoUrl?: string | null;
  trailerUrl?: string | null;
  sceneThumbnails?: Array<{ url: string; emotionScore?: number }>;
}): ThumbnailCandidate[] {
  const candidates: ThumbnailCandidate[] = [];

  const poster = item.posterUrl?.trim();
  if (poster) candidates.push({ url: poster, score: 0.7, source: "poster" });

  const streamStill = getStreamThumbnailUrl(item.videoUrl ?? item.trailerUrl, { time: "8s" });
  if (streamStill) candidates.push({ url: streamStill, score: 0.85, source: "stream-still" });

  const gif = getStreamThumbnailGifUrl(item.videoUrl ?? item.trailerUrl);
  if (gif) candidates.push({ url: gif, score: 0.9, source: "stream-gif" });

  if (item.backdropUrl) {
    candidates.push({ url: item.backdropUrl, score: 0.6, source: "backdrop" });
  }

  for (const scene of item.sceneThumbnails ?? []) {
    candidates.push({
      url: scene.url,
      score: 0.75 + (scene.emotionScore ?? 0) * 0.2,
      source: "stream-still",
    });
  }

  const display = getDisplayPosterUrl(item);
  if (display && !candidates.some((c) => c.url === display)) {
    candidates.push({ url: display, score: 0.8, source: "stream-still" });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export function selectBestThumbnail(
  item: Parameters<typeof rankThumbnailCandidates>[0],
): string | null {
  return rankThumbnailCandidates(item)[0]?.url ?? getDisplayPosterUrl(item);
}
