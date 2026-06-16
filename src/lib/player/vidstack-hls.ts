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

/** Set bundled hls.js on the provider before Vidstack calls `setup()` (avoids CDN + native WMP handoff). */
function patchHlsProviderLoader(): void {
  if (loaderPatched || typeof window === "undefined") return;
  loaderPatched = true;

  const originalLoad = HLSProviderLoader.prototype.load;
  HLSProviderLoader.prototype.load = async function loadWithBundledHls(context) {
    const provider = await originalLoad.call(this, context);
    if (provider && typeof provider === "object" && "library" in provider) {
      (provider as { library: typeof Hls }).library = Hls;
    }
    return provider;
  };
}

patchHlsProviderLoader();

export function configureVidstackHlsProvider(provider: MediaProviderAdapter | null): void {
  if (!provider || !isHLSProvider(provider)) return;

  provider.library = VIDSTACK_HLS_LIBRARY;
  provider.config = {
    ...provider.config,
    preferManagedMediaSource: false,
    enableWorker: true,
    lowLatencyMode: false,
  };
}

export function isHlsJsSupported(): boolean {
  return typeof window !== "undefined" && Hls.isSupported();
}
