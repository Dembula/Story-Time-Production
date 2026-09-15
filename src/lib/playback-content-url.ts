import { prisma } from "@/lib/prisma";
import { isLongFormType } from "@/lib/content-types";

export {
  buildHlsManifestProxyUrl,
  decodeUpstreamPlaybackRef,
  encodeUpstreamPlaybackRef,
} from "@/lib/playback-hls-proxy-url";

export async function resolvePublishedContentVideoUrl(
  contentId: string,
  options?: { episodeId?: string | null; trailer?: boolean },
): Promise<string | null> {
  const episodeId = options?.episodeId?.trim() || null;
  const isTrailer = options?.trailer === true;

  const content = await prisma.content.findFirst({
    where: { id: contentId, published: true },
    select: {
      videoUrl: true,
      trailerUrl: true,
      type: true,
      seasons: {
        where: { published: true },
        orderBy: { seasonNumber: "asc" },
        select: {
          episodes: {
            orderBy: { episodeNumber: "asc" },
            select: { id: true, videoUrl: true },
          },
        },
      },
    },
  });

  if (!content) return null;

  let videoUrl = isTrailer ? content.trailerUrl : content.videoUrl;

  if (!isTrailer && episodeId) {
    const episode = content.seasons
      .flatMap((s) => s.episodes)
      .find((e) => e.id === episodeId);
    videoUrl = episode?.videoUrl ?? null;
  } else if (!isTrailer && !videoUrl && isLongFormType(content.type)) {
    videoUrl = content.seasons.flatMap((s) => s.episodes).find((e) => e.videoUrl)?.videoUrl ?? null;
  }

  return videoUrl?.trim() || null;
}

/** Pick feature/trailer/episode video URL from an already-loaded content row. */
export function pickPublishedContentVideoUrl(
  content: {
    videoUrl?: string | null;
    trailerUrl?: string | null;
    type?: string | null;
    seasons?: Array<{
      episodes: Array<{ id: string; videoUrl?: string | null; duration?: number | null }>;
    }>;
  },
  options?: { episodeId?: string | null; trailer?: boolean },
): string | null {
  const episodeId = options?.episodeId?.trim() || null;
  const isTrailer = options?.trailer === true;
  let videoUrl = isTrailer ? content.trailerUrl : content.videoUrl;

  if (!isTrailer && episodeId) {
    const episode = (content.seasons ?? [])
      .flatMap((s) => s.episodes)
      .find((e) => e.id === episodeId);
    videoUrl = episode?.videoUrl ?? null;
  } else if (!isTrailer && !videoUrl && isLongFormType(content.type ?? "")) {
    videoUrl =
      (content.seasons ?? []).flatMap((s) => s.episodes).find((e) => e.videoUrl)?.videoUrl ?? null;
  }

  return videoUrl?.trim() || null;
}
