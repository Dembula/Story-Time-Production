import { extractCloudflareStreamUid } from "@/lib/cloudflare-stream";

const warmedManifests = new Set<string>();
const warmedOrigins = new Set<string>();
const warmedRoutes = new Set<string>();
const warmedMetadata = new Map<string, number>();
const warmedSegments = new Set<string>();

const METADATA_TTL_MS = 60_000;

type PrefetchPayload = {
  contentId: string;
  videoUrl?: string | null;
  trailerUrl?: string | null;
  posterUrl?: string | null;
};

/** Speculative route prefetch (Next.js router). */
export function prefetchBrowseRoute(href: string, router?: { prefetch: (url: string) => void }) {
  if (warmedRoutes.has(href) || !router) return;
  warmedRoutes.add(href);
  try {
    router.prefetch(href);
  } catch {
    warmedRoutes.delete(href);
  }
}

/** Warm HLS manifest in browser cache via low-priority fetch. */
export function warmPlaybackManifest(videoUrl: string | null | undefined) {
  if (typeof window === "undefined") return;
  const url = videoUrl?.trim();
  if (!url) return;

  const manifest = resolveManifestUrl(url);
  warmMediaOrigin(manifest ?? url);
  if (!manifest || warmedManifests.has(manifest)) return;
  warmedManifests.add(manifest);

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "fetch";
  link.href = manifest;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);

  void fetch(manifest, { method: "GET", mode: "cors", credentials: "omit" })
    .then(async (response) => {
      if (!response.ok) {
        warmedManifests.delete(manifest);
        return;
      }
      if (!/\.m3u8(\?|$)/i.test(manifest)) return;
      const text = await response.text().catch(() => "");
      if (!text) return;
      const firstSegment = await resolveFirstHlsSegmentUrl(manifest, text);
      if (!firstSegment || warmedSegments.has(firstSegment)) return;
      warmedSegments.add(firstSegment);
      void fetch(firstSegment, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
      }).catch(() => {
        warmedSegments.delete(firstSegment);
      });
    })
    .catch(() => {
      warmedManifests.delete(manifest);
    });
}

function resolveManifestUrl(videoUrl: string): string | null {
  if (/\.m3u8(\?|$)|\.mpd(\?|$)/i.test(videoUrl)) return videoUrl;
  const uid = extractCloudflareStreamUid(videoUrl);
  return uid ? `https://videodelivery.net/${uid}/manifest/video.m3u8` : null;
}

function warmMediaOrigin(url: string) {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return;
  }
  if (warmedOrigins.has(origin)) return;
  warmedOrigins.add(origin);

  for (const rel of ["preconnect", "dns-prefetch"] as const) {
    const link = document.createElement("link");
    link.rel = rel;
    link.href = origin;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
}

/** Preload poster / thumbnail image. */
export function warmThumbnail(url: string | null | undefined) {
  if (!url || typeof window === "undefined") return;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

/** Fetch lightweight metadata for instant detail overlay. */
export async function warmContentMetadata(contentId: string): Promise<void> {
  const last = warmedMetadata.get(contentId);
  if (last && Date.now() - last < METADATA_TTL_MS) return;

  warmedMetadata.set(contentId, Date.now());
  try {
    await fetch(`/api/content/${contentId}/playback-bundle`, { priority: "low" } as RequestInit);
  } catch {
    warmedMetadata.delete(contentId);
  }
}

/** Orchestrated hover prefetch — call before click. */
export function prefetchOnContentHover(
  payload: PrefetchPayload,
  router?: { prefetch: (url: string) => void },
) {
  const detailHref = `/browse/content/${payload.contentId}`;
  const watchHref = `/browse/content/${payload.contentId}/watch`;

  prefetchBrowseRoute(detailHref, router);
  warmThumbnail(payload.posterUrl);
  warmPlaybackManifest(payload.trailerUrl ?? payload.videoUrl);
  void warmContentMetadata(payload.contentId);

  if (payload.videoUrl) {
    prefetchBrowseRoute(watchHref, router);
  }
}

async function resolveFirstHlsSegmentUrl(manifestUrl: string, manifestText: string): Promise<string | null> {
  const lines = manifestText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#EXT-X-SESSION-DATA"));

  // Master playlist: choose first variant and inspect media playlist.
  const variantLine = lines.find((line) => !line.startsWith("#") && /\.m3u8(\?|$)/i.test(line));
  if (variantLine) {
    try {
      const variantUrl = new URL(variantLine, manifestUrl).toString();
      const variantRes = await fetch(variantUrl, { method: "GET", mode: "cors", credentials: "omit" });
      if (!variantRes.ok) return null;
      const variantText = await variantRes.text().catch(() => "");
      if (!variantText) return null;
      return resolveFirstHlsSegmentUrl(variantUrl, variantText);
    } catch {
      return null;
    }
  }

  const segmentLine = lines.find((line) => !line.startsWith("#"));
  if (!segmentLine) return null;
  try {
    return new URL(segmentLine, manifestUrl).toString();
  } catch {
    return null;
  }
}
