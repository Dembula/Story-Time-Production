import Hls from "hls.js";
import {
  HLSProviderLoader,
  isHLSProvider,
  type MediaProviderAdapter,
} from "@vidstack/react";

/** Bundled hls.js constructor — never load from jsdelivr (blocked CDN / redirect loops). */
export const VIDSTACK_HLS_LIBRARY = Hls;

if (typeof window !== "undefined") {
  (window as Window & { Hls?: typeof Hls }).Hls = Hls;
}

let loaderPatched = false;

type HlsProviderLike = MediaProviderAdapter & {
  loadSource?: (src: { src?: string; type?: string }, preload?: string) => Promise<void>;
  media?: HTMLVideoElement;
  __storytimeHlsPatched?: boolean;
};

/** Windows hands `.m3u8` on `<source>` / `<video src>` to Windows Media Player before hls.js attaches. */
export function shouldBlockNativeHlsHandoff(): boolean {
  if (typeof window === "undefined") return false;
  if (/Windows/i.test(navigator.userAgent)) return true;
  return Hls.isSupported();
}

function stripNativeHlsTargets(video: HTMLVideoElement): void {
  video.removeAttribute("src");
  video.querySelectorAll("source").forEach((node) => node.remove());
}

function patchProviderLoadSource(provider: HlsProviderLike): void {
  if (provider.__storytimeHlsPatched || !shouldBlockNativeHlsHandoff()) return;
  const originalLoadSource = provider.loadSource?.bind(provider);
  if (!originalLoadSource) return;

  provider.__storytimeHlsPatched = true;
  provider.loadSource = async (src, preload) => {
    const video = provider.media;
    let observer: MutationObserver | null = null;

    if (video) {
      stripNativeHlsTargets(video);
      observer = new MutationObserver(() => {
        stripNativeHlsTargets(video);
      });
      observer.observe(video, {
        childList: true,
        attributes: true,
        attributeFilter: ["src"],
      });
    }

    try {
      await originalLoadSource(src, preload);
    } finally {
      observer?.disconnect();
      if (video) stripNativeHlsTargets(video);
    }
  };
}

/** Set bundled hls.js on the provider before Vidstack calls `setup()` (avoids CDN + native WMP handoff). */
function patchHlsProviderLoader(): void {
  if (loaderPatched || typeof window === "undefined") return;
  loaderPatched = true;

  const originalLoad = HLSProviderLoader.prototype.load;
  HLSProviderLoader.prototype.load = async function loadWithBundledHls(context) {
    const provider = (await originalLoad.call(this, context)) as HlsProviderLike | null;
    if (provider && typeof provider === "object" && "library" in provider) {
      provider.library = Hls;
      patchProviderLoadSource(provider);
    }
    return provider;
  };
}

patchHlsProviderLoader();

export function configureVidstackHlsProvider(provider: MediaProviderAdapter | null): void {
  if (!provider || !isHLSProvider(provider)) return;

  const hlsProvider = provider as HlsProviderLike;
  provider.library = VIDSTACK_HLS_LIBRARY;
  provider.config = {
    ...provider.config,
    preferManagedMediaSource: false,
    enableWorker: !/Windows/i.test(navigator.userAgent),
    lowLatencyMode: false,
  };
  patchProviderLoadSource(hlsProvider);
}

export function isHlsJsSupported(): boolean {
  return typeof window !== "undefined" && Hls.isSupported();
}
