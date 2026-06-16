import Hls from "hls.js";
import {
  HLSProviderLoader,
  isHLSProvider,
  type MediaProviderAdapter,
} from "@vidstack/react";
import { usesAppleNativePlayer } from "@/lib/player/native-player-guard";

/** Bundled hls.js constructor — never load from jsdelivr (blocked CDN / redirect loops). */
export const VIDSTACK_HLS_LIBRARY = Hls;

if (typeof window !== "undefined") {
  (window as Window & { Hls?: typeof Hls }).Hls = Hls;
}

let loaderPatched = false;

/** Laptops/desktops use direct hls.js player. iOS uses Safari native HLS via Vidstack. */
export function usesInBrowserHlsEngine(): boolean {
  if (typeof window === "undefined") return true;
  return !usesAppleNativePlayer();
}

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

/** iOS Vidstack HLS provider — bundled library, no CDN. */
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
