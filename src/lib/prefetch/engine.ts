import { PLATFORM_INTRO_PREFETCH_PATHS } from "@/lib/platform-intro";

const warmedManifests = new Set<string>();
const warmedOrigins = new Set<string>();
const warmedRoutes = new Set<string>();
const warmedMetadata = new Map<string, number>();
let introAssetsWarmed = false;

const METADATA_TTL_MS = 60_000;

type PrefetchPayload = {
  contentId: string;
  videoUrl?: string | null;
  trailerUrl?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
};

const warmedImages = new Set<string>();

function scheduleIdle(task: () => void) {
  if (typeof window === "undefined") return;
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") {
    ric(() => task(), { timeout: 1800 });
    return;
  }
  window.setTimeout(task, 120);
}

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

/** Warm an HLS manifest already resolved by playback-bundle (same-origin proxy or .m3u8). */
export function warmPlaybackManifest(manifestUrl: string | null | undefined) {
  if (typeof window === "undefined") return;
  const url = manifestUrl?.trim();
  if (!url) return;

  const isManifest =
    /\.m3u8(\?|$)/i.test(url) || url.includes("/hls-manifest");
  if (!isManifest) return;

  warmMediaOrigin(url);
  warmPlatformIntroAssets();
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

/** Prefetch bumper fMP4 segments so slow networks don't stall the first frames. */
function warmPlatformIntroAssets() {
  if (introAssetsWarmed || typeof window === "undefined") return;
  introAssetsWarmed = true;
  for (const path of PLATFORM_INTRO_PREFETCH_PATHS) {
    void fetch(path, { method: "GET", mode: "cors", credentials: "omit", priority: "low" } as RequestInit).catch(
      () => {},
    );
  }
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

/** Preload poster / backdrop / thumbnail image into the browser cache. */
export function warmThumbnail(url: string | null | undefined) {
  if (!url || typeof window === "undefined") return;
  const trimmed = url.trim();
  if (!trimmed || warmedImages.has(trimmed)) return;
  warmedImages.add(trimmed);
  try {
    warmMediaOrigin(trimmed);
  } catch {
    // ignore bad URLs
  }
  const img = new Image();
  img.decoding = "async";
  img.src = trimmed;
}

/** Warm a batch of media URLs during idle time (posters, backdrops, etc.). */
export function warmMediaUrls(urls: Array<string | null | undefined>, limit = 36) {
  if (typeof window === "undefined") return;
  const unique = Array.from(
    new Set(
      urls
        .map((u) => u?.trim())
        .filter((u): u is string => Boolean(u) && /^https?:\/\//i.test(u as string)),
    ),
  ).slice(0, limit);

  if (!unique.length) return;

  scheduleIdle(() => {
    for (const url of unique) warmThumbnail(url);
  });
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
  warmThumbnail(payload.backdropUrl);
  void warmContentMetadata(payload.contentId);

  if (payload.videoUrl) {
    prefetchBrowseRoute(watchHref, router);
  }
}

/**
 * Warm landing + browse entry points while the splash/bar is up or on first paint:
 * spotlight posters, common auth/browse routes, and brand assets.
 */
export function warmPlatformEntryAssets(router?: { prefetch: (url: string) => void }) {
  if (typeof window === "undefined") return;

  prefetchBrowseRoute("/browse", router);
  prefetchBrowseRoute("/auth/signin", router);
  prefetchBrowseRoute("/auth/signup", router);
  prefetchBrowseRoute("/auth/creator/signup", router);
  warmThumbnail("/st-mark.png");
  warmThumbnail("/logo.png");
  warmPlatformIntroAssets();

  scheduleIdle(() => {
    void (async () => {
      try {
        const res = await fetch("/api/landing/spotlight", { cache: "force-cache" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          items?: Array<{ id?: string; posterUrl?: string | null }>;
        };
        const items = Array.isArray(data.items) ? data.items : [];
        warmMediaUrls(
          items.map((item) => item.posterUrl),
          24,
        );
        for (const item of items.slice(0, 6)) {
          if (item.id) {
            prefetchBrowseRoute(`/browse/content/${item.id}`, router);
            void warmContentMetadata(item.id);
          }
        }
      } catch {
        // Non-blocking
      }
    })();
  });
}
