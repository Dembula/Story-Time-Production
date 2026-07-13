import { resolveStorageObjectRef } from "@/lib/storage-object-ref";
import { getStorageObjectSignedUrl } from "@/lib/storage-object-fetch";
import { packBrowserMediaUrl } from "@/lib/pack-storage-media-url";
import { packDisplayImageUrl } from "@/lib/content-media-urls";

/**
 * Browser-safe image URL for catalogue art.
 * Private `s3://` / storage objects get a short-lived signed GET so next/image can load them.
 */
export async function packPlatformImageUrl(
  value: string | null | undefined,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  // Already a Cloudflare / remote http URL — keep as-is.
  if (/^https?:\/\//i.test(trimmed) && !resolveStorageObjectRef(trimmed)) {
    return trimmed;
  }

  const packed = packDisplayImageUrl(trimmed) ?? packBrowserMediaUrl(trimmed);
  const ref = resolveStorageObjectRef(trimmed) ?? (packed ? resolveStorageObjectRef(packed) : null);
  if (ref) {
    try {
      return await getStorageObjectSignedUrl(ref, expiresInSeconds);
    } catch {
      // fall through
    }
  }

  if (packed && /^https?:\/\//i.test(packed)) return packed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

/** Never leave `s3://` on catalogue rows — clients cannot render those. */
export async function packBrowseContentMedia<
  T extends {
    posterUrl?: string | null;
    backdropUrl?: string | null;
    videoUrl?: string | null;
    trailerUrl?: string | null;
  },
>(item: T): Promise<T> {
  const [posterUrl, backdropUrl] = await Promise.all([
    packPlatformImageUrl(item.posterUrl),
    packPlatformImageUrl(item.backdropUrl),
  ]);

  return {
    ...item,
    // Prefer poster; if missing, allow portrait cards to use backdrop art.
    posterUrl: posterUrl ?? backdropUrl ?? null,
    backdropUrl: backdropUrl ?? null,
  };
}

export async function packBrowseContentList<
  T extends {
    posterUrl?: string | null;
    backdropUrl?: string | null;
    videoUrl?: string | null;
    trailerUrl?: string | null;
  },
>(items: T[]): Promise<T[]> {
  return Promise.all(items.map((item) => packBrowseContentMedia(item)));
}
