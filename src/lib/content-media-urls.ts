import { buildCloudflarePlaybackUrls, extractCloudflareStreamUid, isCloudflareStreamUrl } from "@/lib/cloudflare-stream";

/** Prefer Cloudflare Stream generated thumbnail when video is on Stream. */
export function getStreamThumbnailUrl(
  videoUrl: string | null | undefined,
  posterUrl: string | null | undefined,
  options?: { time?: string },
): string | null {
  const uid = extractCloudflareStreamUid(videoUrl ?? undefined);
  if (uid) {
    const time = options?.time ?? "2s";
    return `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?time=${encodeURIComponent(time)}`;
  }
  return posterUrl?.trim() || null;
}

/** Animated preview strip when supported (Cloudflare thumbnail GIF). */
export function getStreamThumbnailGifUrl(videoUrl: string | null | undefined): string | null {
  const uid = extractCloudflareStreamUid(videoUrl ?? undefined);
  if (!uid) return null;
  return `https://videodelivery.net/${uid}/thumbnails/thumbnail.gif?time=1s&duration=4s&height=400`;
}

export function getDisplayPosterUrl(item: {
  posterUrl?: string | null;
  backdropUrl?: string | null;
  videoUrl?: string | null;
  trailerUrl?: string | null;
}): string | null {
  return (
    getStreamThumbnailUrl(item.trailerUrl ?? item.videoUrl, item.posterUrl, { time: "3s" }) ??
    item.backdropUrl ??
    null
  );
}

export function getDisplayBackdropUrl(item: {
  posterUrl?: string | null;
  backdropUrl?: string | null;
  videoUrl?: string | null;
}): string | null {
  if (item.backdropUrl) return item.backdropUrl;
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
    return buildCloudflarePlaybackUrls(uid, "https://videodelivery.net").thumbnailUrl + "?height=720";
  }
  return item.posterUrl ?? null;
}
