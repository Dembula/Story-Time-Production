import {
  getDisplayBackdropUrl,
  getDisplayPosterUrl,
  packDisplayImageUrl,
} from "@/lib/content-media-urls";
import { resolveStorageObjectRef } from "@/lib/storage-object-ref";
import { getStorageObjectSignedUrl } from "@/lib/storage-object-fetch";
import { packBrowserMediaUrl } from "@/lib/pack-storage-media-url";

/** Prefer a signed GET for private platform objects; fall back to packed HTTPS. */
export async function packAdminImageUrl(value: string | null | undefined): Promise<string | null> {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const packed = packDisplayImageUrl(trimmed) ?? packBrowserMediaUrl(trimmed);
  const ref = resolveStorageObjectRef(trimmed) ?? (packed ? resolveStorageObjectRef(packed) : null);
  if (ref) {
    try {
      return await getStorageObjectSignedUrl(ref, 60 * 60);
    } catch {
      // fall through to packed public URL
    }
  }
  return packed;
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

  let posterUrl = await packAdminImageUrl(item.posterUrl);
  if (!posterUrl) posterUrl = await packAdminImageUrl(displayPoster);
  posterUrl = posterUrl ?? displayPoster;

  let backdropUrl = await packAdminImageUrl(item.backdropUrl);
  if (!backdropUrl) backdropUrl = await packAdminImageUrl(displayBackdrop);
  backdropUrl = backdropUrl ?? displayBackdrop;

  let btsVideos = item.btsVideos;
  if (Array.isArray(btsVideos)) {
    btsVideos = await Promise.all(
      btsVideos.map(async (b) => ({
        ...b,
        thumbnail: (await packAdminImageUrl(b.thumbnail)) ?? b.thumbnail ?? null,
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
