import {
  getDisplayBackdropUrl,
  getDisplayPosterUrl,
} from "@/lib/content-media-urls";
import { packPlatformImageUrl } from "@/lib/browse-media-pack";

/** Prefer a signed GET for private platform objects; fall back to packed HTTPS. */
export async function packAdminImageUrl(value: string | null | undefined): Promise<string | null> {
  return packPlatformImageUrl(value);
}

export async function packAdminContentMediaFields<
  T extends {
    posterUrl?: string | null;
    backdropUrl?: string | null;
    videoUrl?: string | null;
    trailerUrl?: string | null;
    btsVideos?: Array<{ thumbnail?: string | null; videoUrl?: string | null }>;
  },
>(item: T): Promise<T> {
  const displayPoster = getDisplayPosterUrl(item);
  const displayBackdrop = getDisplayBackdropUrl(item);

  let posterUrl = await packPlatformImageUrl(item.posterUrl);
  if (!posterUrl) posterUrl = await packPlatformImageUrl(displayPoster);
  posterUrl = posterUrl ?? displayPoster;

  let backdropUrl = await packPlatformImageUrl(item.backdropUrl);
  if (!backdropUrl) backdropUrl = await packPlatformImageUrl(displayBackdrop);
  backdropUrl = backdropUrl ?? displayBackdrop;

  let btsVideos = item.btsVideos;
  if (Array.isArray(btsVideos)) {
    btsVideos = await Promise.all(
      btsVideos.map(async (b) => ({
        ...b,
        thumbnail: (await packPlatformImageUrl(b.thumbnail)) ?? b.thumbnail ?? null,
      })),
    );
  }

  return {
    ...item,
    posterUrl,
    backdropUrl,
    btsVideos,
  };
}
