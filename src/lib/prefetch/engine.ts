import { extractCloudflareStreamUid } from "@/lib/cloudflare-stream";

const warmedManifests = new Set<string>();
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
  const uid = extractCloudflareStreamUid(videoUrl ?? undefined);
  const manifest = uid ? `https://videodelivery.net/${uid}/manifest/video.m3u8` : null;
  if (!manifest || warmedManifests.has(manifest)) return;
  warmedManifests.add(manifest);

  if (typeof window === "undefined") return;

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
