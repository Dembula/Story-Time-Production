type WebKitVideoElement = HTMLVideoElement & {
  webkitDisplayingFullscreen?: boolean;
  webkitExitFullscreen?: () => void;
};

/** Exit document, container, or native video fullscreen before leaving watch. */
export async function exitPlaybackFullscreen(options?: {
  container?: HTMLElement | null;
  video?: HTMLVideoElement | null;
}): Promise<void> {
  if (typeof document === "undefined") return;

  const video = options?.video as WebKitVideoElement | null | undefined;
  if (video?.webkitDisplayingFullscreen && typeof video.webkitExitFullscreen === "function") {
    try {
      video.webkitExitFullscreen();
    } catch {
      // no-op
    }
  }

  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => void;
  };

  const fullscreenEl = document.fullscreenElement ?? doc.webkitFullscreenElement;
  if (!fullscreenEl) return;

  try {
    if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
      await document.exitFullscreen();
      return;
    }
    if (typeof doc.webkitExitFullscreen === "function") {
      doc.webkitExitFullscreen();
    }
  } catch {
    // Chrome may reject while a gesture handler is still settling.
  }

  const container = options?.container;
  if (container && (document.fullscreenElement === container || doc.webkitFullscreenElement === container)) {
    try {
      if (typeof document.exitFullscreen === "function") {
        await document.exitFullscreen();
      }
    } catch {
      // no-op
    }
  }
}

import {
  markSkipRouteEnterAnimation,
  showNavExitOverlay,
} from "@/lib/navigation/route-transition";

type WatchExitRouter = {
  replace: (href: string) => void;
  prefetch?: (href: string) => void;
};

/** Always return to the title detail page — do not rely on history.back() in Chrome. */
export async function leaveWatchRoute(
  router: WatchExitRouter,
  contentDetailUrl: string,
  options?: {
    pause?: () => void;
    container?: HTMLElement | null;
    video?: HTMLVideoElement | null;
  },
): Promise<void> {
  options?.pause?.();
  await exitPlaybackFullscreen({
    container: options?.container,
    video: options?.video,
  });
  router.prefetch?.(contentDetailUrl);
  showNavExitOverlay();
  markSkipRouteEnterAnimation();
  router.replace(contentDetailUrl);
}
