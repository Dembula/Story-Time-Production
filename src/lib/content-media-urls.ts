import { buildCloudflarePlaybackUrls, extractCloudflareStreamUid, isCloudflareStreamUrl } from "@/lib/cloudflare-stream";
import { packBrowserMediaUrl } from "@/lib/pack-storage-media-url";

function isUploadedImageUrl(url: string | null | undefined): boolean {
  const value = url?.trim();
  if (!value) return false;
  return !isCloudflareStreamUrl(value) && !/videodelivery\.net/i.test(value);
}

/** Pack `s3://` (or keep https) so `<img>` / next/image can load catalogue artwork. */
export function packDisplayImageUrl(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;
  if (!isUploadedImageUrl(value)) return null;
  return packBrowserMediaUrl(value) ?? (value.startsWith("s3://") ? null : value);
}

/** Stream-generated frame — fallback only when no creator artwork exists. */
export function getStreamThumbnailUrl(
  videoUrl: string | null | undefined,
  options?: { time?: string; height?: number },
): string | null {
  const uid = extractCloudflareStreamUid(videoUrl ?? undefined);
  if (!uid) return null;
  const time = options?.time ?? "2s";
  const params = new URLSearchParams({ time });
  if (options?.height) params.set("height", String(options.height));
  return `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?${params.toString()}`;
}

/** Animated preview strip when supported (Cloudflare thumbnail GIF). */
export function getStreamThumbnailGifUrl(videoUrl: string | null | undefined): string | null {
  const uid = extractCloudflareStreamUid(videoUrl ?? undefined);
  if (!uid) return null;
  return `https://videodelivery.net/${uid}/thumbnails/thumbnail.gif?time=1s&duration=4s&height=400`;
}

/** Portrait card art — prefer the creator's uploaded poster (fall back to backdrop). */
export function getDisplayPosterUrl(item: {
  posterUrl?: string | null;
  backdropUrl?: string | null;
  videoUrl?: string | null;
  trailerUrl?: string | null;
}): string | null {
  const poster = packDisplayImageUrl(item.posterUrl);
  if (poster && !poster.startsWith("s3://")) return poster;
  const backdrop = packDisplayImageUrl(item.backdropUrl);
  if (backdrop && !backdrop.startsWith("s3://")) return backdrop;
  return getStreamThumbnailUrl(item.videoUrl, { time: "3s" }) ?? null;
}

/**
 * Wide hero / detail backdrop — prefer the creator's uploaded backdrop.
 * Do not silently swap in portrait poster art when a backdrop exists but failed to pack;
 * callers should pack `backdropUrl` server-side before rendering.
 */
export function getDisplayBackdropUrl(item: {
  posterUrl?: string | null;
  backdropUrl?: string | null;
  videoUrl?: string | null;
}): string | null {
  const backdrop = packDisplayImageUrl(item.backdropUrl);
  if (backdrop && !backdrop.startsWith("s3://")) return backdrop;

  // Raw https already set by browse packaging
  const rawBackdrop = item.backdropUrl?.trim();
  if (rawBackdrop && /^https?:\/\//i.test(rawBackdrop) && !isCloudflareStreamUrl(rawBackdrop)) {
    return rawBackdrop;
  }

  const uid = extractCloudflareStreamUid(item.videoUrl ?? undefined);
  if (uid) {
    try {
      if (isCloudflareStreamUrl(item.videoUrl ?? "")) {
        const u = new URL(item.videoUrl!);
        if (/cloudflarestream\.com/i.test(u.hostname)) {
          return `${u.origin}/${uid}/thumbnails/thumbnail.jpg?time=5s&height=720`;
        }
      }
    } catch {
      // fall through
    }
    return `${buildCloudflarePlaybackUrls(uid, "https://videodelivery.net").thumbnailUrl}?time=5s&height=720`;
  }

  // Last resort only when there is no backdrop at all
  if (!rawBackdrop) {
    const poster = packDisplayImageUrl(item.posterUrl);
    if (poster && !poster.startsWith("s3://")) return poster;
  }
  return null;
}
