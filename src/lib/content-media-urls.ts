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

/** Portrait card art — always prefer the creator's uploaded poster. */
export function getDisplayPosterUrl(item: {
  posterUrl?: string | null;
  backdropUrl?: string | null;
  videoUrl?: string | null;
  trailerUrl?: string | null;
}): string | null {
  const poster = packDisplayImageUrl(item.posterUrl);
  if (poster) return poster;
  return getStreamThumbnailUrl(item.videoUrl, { time: "3s" }) ?? null;
}

/** Wide hero / detail backdrop — always prefer the creator's uploaded backdrop. */
export function getDisplayBackdropUrl(item: {
  posterUrl?: string | null;
  backdropUrl?: string | null;
  videoUrl?: string | null;
}): string | null {
  const backdrop = packDisplayImageUrl(item.backdropUrl);
  if (backdrop) return backdrop;
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
  return packDisplayImageUrl(item.posterUrl);
}
