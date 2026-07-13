import {
  buildCloudflarePlaybackUrls,
  extractCloudflareStreamUid,
  getCloudflareStreamConfig,
  isCloudflareStreamUrl,
} from "@/lib/cloudflare-stream";

export type PlaybackMimeType = "application/x-mpegurl" | "video/mp4";

export type PlaybackSource = {
  src: string;
  type: PlaybackMimeType;
};

/** Resolve a stored video URL into the best source for Vidstack (HLS when Cloudflare Stream). */
export function resolvePlaybackSources(videoUrl: string | null | undefined): PlaybackSource | null {
  const url = videoUrl?.trim();
  if (!url) return null;

  const uid = extractCloudflareStreamUid(url);
  if (uid) {
    const cfg = getCloudflareStreamConfig();
    const subdomain =
      cfg?.customerSubdomain ??
      (isCloudflareStreamUrl(url) ? deriveSubdomainFromStreamUrl(url) : "");
    const urls = buildCloudflarePlaybackUrls(uid, subdomain || "https://videodelivery.net");
    return { src: urls.hlsUrl, type: "application/x-mpegurl" };
  }

  if (/\.m3u8(\?|$)/i.test(url)) {
    return { src: url, type: "application/x-mpegurl" };
  }

  return { src: url, type: "video/mp4" };
}

function deriveSubdomainFromStreamUrl(url: string): string {
  try {
    const u = new URL(url);
    if (/cloudflarestream\.com/i.test(u.hostname)) {
      return `https://${u.hostname}`;
    }
  } catch {
    // ignore
  }
  return "https://videodelivery.net";
}

export function resolveTrailerSources(trailerUrl: string | null | undefined): PlaybackSource | null {
  return resolvePlaybackSources(trailerUrl);
}

/** True when the URL points at HLS / Cloudflare Stream (must not use native `<video src>`). */
export function isHlsUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  if (extractCloudflareStreamUid(trimmed) || isCloudflareStreamUrl(trimmed)) return true;
  return /\.m3u8(\?|$)/i.test(trimmed);
}

/** Catalogue rows that must resolve playback through `/api/content/.../playback-bundle`. */
export function requiresStreamPlaybackBundle(url: string | null | undefined): boolean {
  return isHlsUrl(url);
}

/**
 * MP4-only URL for lightweight native `<video>` previews (admin, BTS, profile).
 * Stream/HLS titles must use the in-browser watch player.
 * Rejects `s3://` and other non-http(s) refs — browsers cannot play those.
 */
export function resolveNativeVideoSafeUrl(videoUrl: string | null | undefined): string | null {
  const raw = videoUrl?.trim();
  if (!raw || raw.startsWith("s3://")) return null;

  const source = resolvePlaybackSources(raw);
  if (isNativeVideoSafeSource(source) && /^https?:\/\//i.test(source!.src)) {
    return source!.src;
  }

  const uid = extractCloudflareStreamUid(videoUrl ?? undefined);
  if (uid) {
    const cfg = getCloudflareStreamConfig();
    const subdomain =
      cfg?.customerSubdomain ??
      (videoUrl && isCloudflareStreamUrl(videoUrl) ? deriveSubdomainFromStreamUrl(videoUrl) : "");
    return buildCloudflarePlaybackUrls(uid, subdomain || "https://videodelivery.net").mp4Url;
  }

  return null;
}

/** HLS must play through hls.js in the browser — never assign to a native `<video src>`. */
export function isHlsPlaybackSource(source: PlaybackSource | null | undefined): boolean {
  return source?.type === "application/x-mpegurl";
}

/** Sources safe for native `<video>` (MP4 only). */
export function isNativeVideoSafeSource(source: PlaybackSource | null | undefined): boolean {
  return Boolean(source?.src && source.type === "video/mp4");
}
