import { prisma } from "@/lib/prisma";
import { isLongFormType } from "@/lib/content-types";

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

export function buildHlsManifestProxyUrl(
  contentId: string,
  options?: { episodeId?: string | null; trailer?: boolean },
): string {
  const params = new URLSearchParams();
  if (options?.episodeId) params.set("episodeId", options.episodeId);
  if (options?.trailer) params.set("trailer", "1");
  const qs = params.toString();
  return `/api/content/${contentId}/hls-manifest${qs ? `?${qs}` : ""}`;
}
