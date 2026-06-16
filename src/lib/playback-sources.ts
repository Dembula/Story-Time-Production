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

export type PlaybackSourceOptions = {
  /**
   * DASH-first devices (for example some Edge/TV environments) can prefer MPD
   * when the source supports it.
   */
  preferDash?: boolean;
};

/** Resolve a stored video URL into the best playback source for the current device profile. */
export function resolvePlaybackSources(
  videoUrl: string | null | undefined,
  options?: PlaybackSourceOptions,
): PlaybackSource | null {
  const url = videoUrl?.trim();
  if (!url) return null;

  const uid = extractCloudflareStreamUid(url);
  if (uid) {
    const cfg = getCloudflareStreamConfig();
    const subdomain =
      cfg?.customerSubdomain ??
      (isCloudflareStreamUrl(url) ? deriveSubdomainFromStreamUrl(url) : "");
    const urls = buildCloudflarePlaybackUrls(uid, subdomain || "https://videodelivery.net");
    if (options?.preferDash) {
      return { src: urls.dashUrl, type: "application/dash+xml" };
    }
    return { src: urls.hlsUrl, type: "application/x-mpegurl" };
  }

  if (/\.mpd(\?|$)/i.test(url)) {
    return { src: url, type: "application/dash+xml" };
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
