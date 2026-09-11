import { resolveStorageObjectRef } from "@/lib/storage-object-ref";
import { packBrowserMediaUrl, buildHttpsStorageUrl, getStoragePublicBaseUrl } from "@/lib/pack-storage-media-url";
import { packDisplayImageUrl } from "@/lib/content-media-urls";
import { buildCatalogueMediaProxyUrl, isCatalogueImageKey } from "@/lib/catalogue-media-proxy";

const packMemo = new Map<string, Promise<string | null>>();

function memoizePack(key: string, factory: () => Promise<string | null>): Promise<string | null> {
  const existing = packMemo.get(key);
  if (existing) return existing;
  const pending = factory().finally(() => {
    // Keep successful results briefly for the lifetime of this isolate request burst.
    setTimeout(() => packMemo.delete(key), 30_000).unref?.();
  });
  packMemo.set(key, pending);
  return pending;
}

/**
 * Browser-safe image URL for catalogue art.
 *
 * Preference order:
 * 1) Already-public remote HTTPS (Stream, CDN, etc.)
 * 2) Stable public storage base URL when configured (CDN)
 * 3) Same-origin `/api/media/catalogue/...` proxy (stable cache key for Next Image Optimization)
 *
 * Never return hour-rotating S3 signed URLs for posters — they burn image-opt quota and break caching.
 */
export async function packPlatformImageUrl(
  value: string | null | undefined,
  _expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  return memoizePack(trimmed, async () => {
    // Already a non-storage http URL — keep as-is (Cloudflare Stream thumbs, etc.).
    if (/^https?:\/\//i.test(trimmed) && !resolveStorageObjectRef(trimmed)) {
      return trimmed;
    }

    // Already our stable proxy path.
    if (trimmed.startsWith("/api/media/catalogue/")) {
      return trimmed;
    }

    const packed = packDisplayImageUrl(trimmed) ?? packBrowserMediaUrl(trimmed);
    const ref = resolveStorageObjectRef(trimmed) ?? (packed ? resolveStorageObjectRef(packed) : null);

    if (ref && isCatalogueImageKey(ref.key)) {
      // Prefer configured public CDN when present (stable host + key, optimizable).
      if (getStoragePublicBaseUrl(ref.bucket)) {
        const publicUrl = buildHttpsStorageUrl(ref);
        if (publicUrl) return publicUrl;
      }
      return buildCatalogueMediaProxyUrl(ref);
    }

    if (packed && /^https?:\/\//i.test(packed)) return packed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return null;
  });
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
    id?: string;
    posterUrl?: string | null;
    backdropUrl?: string | null;
    videoUrl?: string | null;
    trailerUrl?: string | null;
  },
>(items: T[]): Promise<T[]> {
  if (items.length === 0) return items;

  // Dedupe by id (or media identity) so browse rows that share titles only pack once.
  const packedByKey = new Map<string, Promise<T>>();
  return Promise.all(
    items.map((item, index) => {
      const key =
        item.id?.trim() ||
        `${item.posterUrl ?? ""}|${item.backdropUrl ?? ""}|${index}`;
      const existing = packedByKey.get(key);
      if (existing) return existing;
      const pending = packBrowseContentMedia(item);
      packedByKey.set(key, pending);
      return pending;
    }),
  );
}
