import { resolveStorageObjectRef } from "@/lib/storage-object-ref";
import {
  packBrowserMediaUrl,
  buildConfiguredPublicStorageUrl,
  hasConfiguredPublicStorageBase,
} from "@/lib/pack-storage-media-url";
import { packDisplayImageUrl } from "@/lib/content-media-urls";
import { buildCatalogueMediaProxyUrl, isCatalogueImageKey } from "@/lib/catalogue-media-proxy";
import { getStorageObjectSignedUrl } from "@/lib/storage-object-fetch";

const packMemo = new Map<string, Promise<string | null>>();

/** Image signed URLs — long enough for a session; MediaImage bypasses optimizer for signed query URLs. */
const IMAGE_SIGNED_TTL_SECONDS = 60 * 60 * 6;

function catalogueProxyEnabled(): boolean {
  const raw = process.env.CATALOGUE_MEDIA_PROXY?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

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
 * Preference order (crash-safe at high concurrency):
 * 1) Already-public remote HTTPS (Stream, CDN, etc.)
 * 2) Configured public storage CDN (`STORAGE_PUBLIC_BASE_URL`) — stable + optimizable
 * 3) Direct S3 signed URL (no Vercel origin bandwidth) — default for private buckets
 * 4) Optional `/api/media/catalogue/...` proxy only when `CATALOGUE_MEDIA_PROXY=1`
 *
 * Never emit bare private `bucket.s3.region.amazonaws.com` URLs — they 403 and look like an outage.
 */
export async function packPlatformImageUrl(
  value: string | null | undefined,
  expiresInSeconds = IMAGE_SIGNED_TTL_SECONDS,
): Promise<string | null> {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  return memoizePack(`${trimmed}|${expiresInSeconds}`, async () => {
    try {
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
        // Real CDN / public base only — never the inferred private S3 hostname.
        if (hasConfiguredPublicStorageBase()) {
          const publicUrl = buildConfiguredPublicStorageUrl(ref);
          if (publicUrl) return publicUrl;
        }

        // Default at scale: signed URL straight from S3 (no serverless byte-proxy stampede).
        try {
          return await getStorageObjectSignedUrl(ref, expiresInSeconds);
        } catch {
          // Optional opt-in proxy as last resort (streams through Vercel — keep off under load).
          if (catalogueProxyEnabled()) {
            return buildCatalogueMediaProxyUrl(ref);
          }
          return null;
        }
      }

      if (packed && /^https?:\/\//i.test(packed)) {
        // packBrowserMediaUrl may have built a private S3 host URL — only keep if CDN configured
        // or the URL already carries a signature.
        if (hasConfiguredPublicStorageBase()) return packed;
        if (/[?&]X-Amz-Signature=/i.test(packed) || /[?&]Signature=/i.test(packed)) return packed;
        const packedRef = resolveStorageObjectRef(packed);
        if (packedRef && isCatalogueImageKey(packedRef.key)) {
          try {
            return await getStorageObjectSignedUrl(packedRef, expiresInSeconds);
          } catch {
            return null;
          }
        }
        return packed;
      }

      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return null;
    } catch {
      return null;
    }
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
      const pending = packBrowseContentMedia(item).catch(() => item);
      packedByKey.set(key, pending);
      return pending;
    }),
  );
}
