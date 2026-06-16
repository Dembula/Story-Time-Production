import {
  buildCloudflarePlaybackUrls,
  extractCloudflareStreamUid,
  getCloudflareStreamConfig,
  isCloudflareStreamUrl,
} from "@/lib/cloudflare-stream";

export type PlaybackMimeType =
  | "application/x-mpegurl"
  | "application/dash+xml"
  | "video/mp4";

export type PlaybackSource = {
  src: string;
  type: PlaybackMimeType;
};

export type PlaybackSourceSet = {
  /** Universally compatible primary source (HLS for Stream, otherwise the raw URL). */
  primary: PlaybackSource;
  /** Additional formats (e.g. DASH) for clients/key-systems that prefer them. */
  alternates: PlaybackSource[];
};

/** Resolve a stored video URL into the best source for Vidstack (HLS when Cloudflare Stream). */
export function resolvePlaybackSources(videoUrl: string | null | undefined): PlaybackSource | null {
  return resolvePlaybackSourceSet(videoUrl)?.primary ?? null;
}

/**
 * Resolve a stored video URL into a full multi-format source set.
 *
 * HLS (CMAF/fMP4) is the primary format because it plays natively on Apple
 * platforms and via hls.js everywhere else, and supports FairPlay, Widevine and
 * PlayReady through EME. DASH is exposed as an alternate for diagnostics and for
 * players that prefer it for Widevine/PlayReady.
 */
export function resolvePlaybackSourceSet(
  videoUrl: string | null | undefined,
): PlaybackSourceSet | null {
  const url = videoUrl?.trim();
  if (!url) return null;

  const uid = extractCloudflareStreamUid(url);
  if (uid) {
    const cfg = getCloudflareStreamConfig();
    const subdomain =
      cfg?.customerSubdomain ??
      (isCloudflareStreamUrl(url) ? deriveSubdomainFromStreamUrl(url) : "");
    const urls = buildCloudflarePlaybackUrls(uid, subdomain || "https://videodelivery.net");
    return {
      primary: { src: urls.hlsUrl, type: "application/x-mpegurl" },
      alternates: [{ src: urls.dashUrl, type: "application/dash+xml" }],
    };
  }

  if (/\.m3u8(\?|$)/i.test(url)) {
    return { primary: { src: url, type: "application/x-mpegurl" }, alternates: [] };
  }

  if (/\.mpd(\?|$)/i.test(url)) {
    return { primary: { src: url, type: "application/dash+xml" }, alternates: [] };
  }

  return { primary: { src: url, type: "video/mp4" }, alternates: [] };
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
