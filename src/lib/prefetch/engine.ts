import { extractCloudflareStreamUid } from "@/lib/cloudflare-stream";

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

/** Warm HLS manifest + first variant in browser cache so the player paints frame 1 immediately. */
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
    .then(async (res) => {
      if (!res.ok) {
        warmedManifests.delete(manifest);
        return;
      }
      const text = await res.text().catch(() => "");
      const childManifest = pickFirstVariantManifest(manifest, text);
      if (!childManifest || warmedManifests.has(childManifest)) return;
      warmedManifests.add(childManifest);
      void fetch(childManifest, { method: "GET", mode: "cors", credentials: "omit" }).catch(() => {
        warmedManifests.delete(childManifest);
      });
    })
    .catch(() => {
      warmedManifests.delete(manifest);
    });
}

function pickFirstVariantManifest(parentUrl: string, manifestText: string): string | null {
  if (!manifestText.includes("#EXT-X-STREAM-INF")) return null;
  const lines = manifestText.split(/\r?\n/);
  let parent: URL;
  try {
    parent = new URL(parentUrl);
  } catch {
    return null;
  }
  for (let i = 0; i < lines.length - 1; i += 1) {
    const tag = lines[i]?.trim();
    if (!tag?.startsWith("#EXT-X-STREAM-INF")) continue;
    const ref = lines[i + 1]?.trim();
    if (!ref || ref.startsWith("#")) continue;
    try {
      return new URL(ref, parent).toString();
    } catch {
      return null;
    }
  }
  return null;
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
