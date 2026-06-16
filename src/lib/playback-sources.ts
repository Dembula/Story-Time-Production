import {
  buildCloudflarePlaybackUrls,
  extractCloudflareStreamUid,
  getCloudflareStreamConfig,
  isCloudflareStreamUrl,
} from "@/lib/cloudflare-stream";

export type PlaybackMimeType = "application/x-mpegurl" | "application/dash+xml" | "video/mp4";

export type PlaybackSource = {
  src: string;
  type: PlaybackMimeType;
};

export type PlaybackSourceSet = {
  primary: PlaybackSource;
  hls: PlaybackSource | null;
  dash: PlaybackSource | null;
  mp4: PlaybackSource | null;
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

/** Resolve HLS, DASH, and MP4 sources for adaptive playback. */
export function resolveAllPlaybackSources(videoUrl: string | null | undefined): PlaybackSourceSet | null {
  const url = videoUrl?.trim();
  if (!url) return null;

  const uid = extractCloudflareStreamUid(url);
  if (uid) {
    const cfg = getCloudflareStreamConfig();
    const subdomain =
      cfg?.customerSubdomain ??
      (isCloudflareStreamUrl(url) ? deriveSubdomainFromStreamUrl(url) : "");
    const urls = buildCloudflarePlaybackUrls(uid, subdomain || "https://videodelivery.net");
    const hls: PlaybackSource = { src: urls.hlsUrl, type: "application/x-mpegurl" };
    const dash: PlaybackSource = { src: urls.dashUrl, type: "application/dash+xml" };
    const mp4: PlaybackSource = { src: urls.mp4Url, type: "video/mp4" };
    return { primary: hls, hls, dash, mp4 };
  }

  if (/\.m3u8(\?|$)/i.test(url)) {
    const hls: PlaybackSource = { src: url, type: "application/x-mpegurl" };
    return { primary: hls, hls, dash: null, mp4: null };
  }

  if (/\.mpd(\?|$)/i.test(url)) {
    const dash: PlaybackSource = { src: url, type: "application/dash+xml" };
    return { primary: dash, hls: null, dash, mp4: null };
  }

  const mp4: PlaybackSource = { src: url, type: "video/mp4" };
  return { primary: mp4, hls: null, dash: null, mp4 };
}
