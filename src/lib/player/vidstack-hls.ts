import Hls from "hls.js";
import {
  HLSProviderLoader,
  isHLSProvider,
  type MediaProviderAdapter,
  type Src,
} from "@vidstack/react";
import { usesAppleNativePlayer } from "@/lib/player/native-player-guard";

/** Bundled hls.js constructor — never load from jsdelivr (blocked CDN / redirect loops). */
export const VIDSTACK_HLS_LIBRARY = Hls;

if (typeof window !== "undefined") {
  (window as Window & { Hls?: typeof Hls }).Hls = Hls;
}

let loaderPatched = false;

type LoadSourceFn = (src: Src, preload?: string) => Promise<void>;

type HlsProviderLike = MediaProviderAdapter & {
  loadSource?: LoadSourceFn;
  appendSource?: (src: Src, defaultType?: string) => void;
  media?: HTMLVideoElement;
  __storytimeHlsPatched?: boolean;
  __storytimeAppendPatched?: boolean;
};

/** Laptops/desktops use hls.js in the page. iOS uses Safari native HLS (see native-player-guard). */
export function usesInBrowserHlsEngine(): boolean {
  if (typeof window === "undefined") return true;
  return !usesAppleNativePlayer();
}

function shouldBlockNativeMediaHandoff(): boolean {
  return usesInBrowserHlsEngine();
}

export function stripNativeHlsTargets(video: HTMLVideoElement): void {
  video.removeAttribute("src");
  video.querySelectorAll("source").forEach((node) => node.remove());
}

/** Desktop only: Vidstack must not append native HLS `<source>` (OS player handoff). */
function patchProviderAppendSource(provider: HlsProviderLike): void {
  if (provider.__storytimeAppendPatched || !shouldBlockNativeMediaHandoff()) return;
  if (typeof provider.appendSource !== "function") return;

  provider.__storytimeAppendPatched = true;
  provider.appendSource = () => {
    // hls.js uses MediaSource on desktop — native sources delegate to the OS player.
  };
}

function patchProviderLoadSource(provider: HlsProviderLike): void {
  if (provider.__storytimeHlsPatched || !shouldBlockNativeMediaHandoff()) return;
  const originalLoadSource = provider.loadSource?.bind(provider) as LoadSourceFn | undefined;
  if (!originalLoadSource) return;

  provider.__storytimeHlsPatched = true;
  patchProviderAppendSource(provider);

  provider.loadSource = async (src: Src, preload?: string) => {
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

function patchHlsProviderLoader(): void {
  if (loaderPatched || typeof window === "undefined") return;
  loaderPatched = true;

  const originalLoad = HLSProviderLoader.prototype.load;
  HLSProviderLoader.prototype.load = async function loadWithBundledHls(context) {
    const provider = await originalLoad.call(this, context);
    if (provider && typeof provider === "object" && "library" in provider) {
      (provider as { library: typeof Hls }).library = Hls;
      patchProviderLoadSource(provider as unknown as HlsProviderLike);
    }
    return provider;
  };
}

patchHlsProviderLoader();

export function guardVideoElementFromNativeHls(video: HTMLVideoElement | null | undefined): () => void {
  if (!video || !shouldBlockNativeMediaHandoff()) return () => undefined;

  stripNativeHlsTargets(video);
  const observer = new MutationObserver(() => {
    stripNativeHlsTargets(video);
  });
  observer.observe(video, {
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });

  return () => observer.disconnect();
}

export function configureVidstackHlsProvider(provider: MediaProviderAdapter | null): void {
  if (!provider || !isHLSProvider(provider)) return;

  const hlsProvider = provider as unknown as HlsProviderLike;
  provider.library = VIDSTACK_HLS_LIBRARY;
  provider.config = {
    ...provider.config,
    preferManagedMediaSource: false,
    enableWorker: true,
    lowLatencyMode: false,
  };

  if (!usesInBrowserHlsEngine()) return;

  patchProviderAppendSource(hlsProvider);
  patchProviderLoadSource(hlsProvider);
}

export function isHlsJsSupported(): boolean {
  return typeof window !== "undefined" && Hls.isSupported();
}
