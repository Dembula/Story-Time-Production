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

/** Warm an HLS manifest already resolved by playback-bundle (never guess unsigned Stream URLs). */
export function warmPlaybackManifest(manifestUrl: string | null | undefined) {
  if (typeof window === "undefined") return;
  const url = manifestUrl?.trim();
  if (!url || !/\.m3u8(\?|$)/i.test(url)) return;

  warmMediaOrigin(url);
  if (warmedManifests.has(url)) return;
  warmedManifests.add(url);

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "fetch";
  link.href = url;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);

  void fetch(url, { method: "GET", mode: "cors", credentials: "omit" }).catch(() => {
    warmedManifests.delete(url);
  });
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
  void warmContentMetadata(payload.contentId);

  if (payload.videoUrl) {
    prefetchBrowseRoute(watchHref, router);
  }
}
