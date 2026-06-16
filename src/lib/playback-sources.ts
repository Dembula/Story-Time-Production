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
  delivery?: "hls" | "dash" | "mp4";
  drm?: "multi-key-cenc" | "clear";
};

/** Resolve a stored video URL into the best source for Vidstack (HLS when Cloudflare Stream). */
export function resolvePlaybackSources(videoUrl: string | null | undefined): PlaybackSource | null {
  return resolvePlaybackSourceSet(videoUrl)[0] ?? null;
}

/** Return every viable source variant in preference order for smart player fallback. */
export function resolvePlaybackSourceSet(videoUrl: string | null | undefined): PlaybackSource[] {
  const url = videoUrl?.trim();
  if (!url) return [];

  const uid = extractCloudflareStreamUid(url);
  if (uid) {
    const cfg = getCloudflareStreamConfig();
    const subdomain =
      cfg?.customerSubdomain ??
      (isCloudflareStreamUrl(url) ? deriveSubdomainFromStreamUrl(url) : "");
    const urls = buildCloudflarePlaybackUrls(uid, subdomain || "https://videodelivery.net");
    return dedupePlaybackSources([
      { src: urls.hlsUrl, type: "application/x-mpegurl", delivery: "hls", drm: "multi-key-cenc" },
      { src: urls.dashUrl, type: "application/dash+xml", delivery: "dash", drm: "multi-key-cenc" },
      { src: urls.mp4Url, type: "video/mp4", delivery: "mp4", drm: "clear" },
    ]);
  }

  if (/\.m3u8(\?|$)/i.test(url)) {
    return [{ src: url, type: "application/x-mpegurl", delivery: "hls", drm: "clear" }];
  }

  if (/\.mpd(\?|$)/i.test(url)) {
    return [{ src: url, type: "application/dash+xml", delivery: "dash", drm: "multi-key-cenc" }];
  }

  return [{ src: url, type: "video/mp4", delivery: "mp4", drm: "clear" }];
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

function dedupePlaybackSources(sources: PlaybackSource[]): PlaybackSource[] {
  const seen = new Set<string>();
  const deduped: PlaybackSource[] = [];
  for (const source of sources) {
    const key = `${source.type}::${source.src}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(source);
  }
  return deduped;
}
