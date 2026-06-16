import { extractCloudflareStreamUid } from "@/lib/cloudflare-stream";
import { isStreamSignedPlaybackClientEnabled } from "@/lib/stream-playback-protection";

const warmedManifests = new Set<string>();
const warmedOrigins = new Set<string>();
const warmedRoutes = new Set<string>();
const warmedMetadata = new Map<string, number>();

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
  if (url.startsWith("blob:")) return;

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

  void fetch(manifest, { method: "GET", mode: "cors", credentials: "omit" }).catch(() => {
    warmedManifests.delete(manifest);
  });
}

function resolveManifestUrl(videoUrl: string): string | null {
  if (/\.m3u8(\?|$)/i.test(videoUrl)) return videoUrl;
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
    await fetch(`/api/content/${contentId}`, { priority: "low" } as RequestInit);
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
  const previewUrl =
    payload.trailerUrl ??
    (isStreamSignedPlaybackClientEnabled() ? null : payload.videoUrl);

  prefetchBrowseRoute(detailHref, router);
  warmThumbnail(payload.posterUrl);
  warmPlaybackManifest(previewUrl);
  void warmContentMetadata(payload.contentId);

  if (payload.videoUrl) {
    prefetchBrowseRoute(watchHref, router);
  }
}
