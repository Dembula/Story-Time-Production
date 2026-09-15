import { resolveStorageObjectRef } from "@/lib/storage-object-ref";
import {
  packBrowserMediaUrl,
  buildConfiguredPublicStorageUrl,
  hasConfiguredPublicStorageBase,
} from "@/lib/pack-storage-media-url";
import { packDisplayImageUrl, getDisplayPosterUrl, getDisplayBackdropUrl } from "@/lib/content-media-urls";
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
    // Keep successful results for a few minutes so feed scroll / detail / play reuse art URLs.
    setTimeout(() => packMemo.delete(key), 5 * 60_000).unref?.();
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
export type PackImageRole = "poster" | "backdrop" | "thumb";

function withStreamThumbnailSize(url: string, role: PackImageRole): string {
  if (!/videodelivery\.net|cloudflarestream\.com/i.test(url)) return url;
  if (!/\/thumbnails\/thumbnail\.(jpg|png|gif)/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("height") || parsed.searchParams.has("width")) return url;
    const height = role === "backdrop" ? 720 : role === "thumb" ? 360 : 480;
    parsed.searchParams.set("height", String(height));
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function packPlatformImageUrl(
  value: string | null | undefined,
  expiresInSeconds = IMAGE_SIGNED_TTL_SECONDS,
  options?: { role?: PackImageRole },
): Promise<string | null> {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const role = options?.role ?? "poster";

  return memoizePack(`${trimmed}|${expiresInSeconds}|${role}`, async () => {
    try {
      // Already a non-storage http URL — keep as-is (Cloudflare Stream thumbs, etc.).
      if (/^https?:\/\//i.test(trimmed) && !resolveStorageObjectRef(trimmed)) {
        return withStreamThumbnailSize(trimmed, role);
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
        if (hasConfiguredPublicStorageBase()) return withStreamThumbnailSize(packed, role);
        if (/[?&]X-Amz-Signature=/i.test(packed) || /[?&]Signature=/i.test(packed)) {
          return withStreamThumbnailSize(packed, role);
        }
        const packedRef = resolveStorageObjectRef(packed);
        if (packedRef && isCatalogueImageKey(packedRef.key)) {
          try {
            return await getStorageObjectSignedUrl(packedRef, expiresInSeconds);
          } catch {
            return null;
          }
        }
        return withStreamThumbnailSize(packed, role);
      }

      if (/^https?:\/\//i.test(trimmed)) return withStreamThumbnailSize(trimmed, role);
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
  const displayPoster = getDisplayPosterUrl(item);
  const displayBackdrop = getDisplayBackdropUrl(item);
  const [posterUrl, backdropUrl] = await Promise.all([
    packPlatformImageUrl(item.posterUrl ?? displayPoster, undefined, { role: "poster" }),
    packPlatformImageUrl(item.backdropUrl ?? displayBackdrop, undefined, { role: "backdrop" }),
  ]);

  return {
    ...item,
    // Prefer poster; if missing, allow portrait cards to use backdrop art.
    posterUrl: posterUrl ?? backdropUrl ?? displayPoster ?? null,
    backdropUrl: backdropUrl ?? displayBackdrop ?? null,
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
