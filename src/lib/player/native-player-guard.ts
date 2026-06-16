type VideoWithWebkit = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

/** iPhone, iPad, iPod, iPadOS — Safari native inline/fullscreen video (not used on laptop/desktop). */
export function usesAppleNativePlayer(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (platform === "MacIntel" &&
      typeof window.navigator.maxTouchPoints === "number" &&
      window.navigator.maxTouchPoints > 1);
  const isIPadOSDesktopUa = /Macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1;
  return isIOS || isIPadOSDesktopUa;
}

/** @deprecated Use {@link usesAppleNativePlayer}. */
export const hasNativeVideoPlayerRisk = usesAppleNativePlayer;

/** Autoplay without a fresh user gesture is blocked or unreliable on Apple devices. */
export function requiresUserGestureToPlay(): boolean {
  return usesAppleNativePlayer();
}

/** Safari native fullscreen — iOS only. */
export function enterAppleNativeFullscreen(video: HTMLVideoElement | null | undefined): void {
  if (!video) return;
  const el = video as VideoWithWebkit;
  if (el.webkitDisplayingFullscreen) return;
  if (typeof el.webkitEnterFullscreen === "function") {
    try {
      el.webkitEnterFullscreen();
    } catch {
      // unsupported or denied
    }
  }
}

/** iOS only: hand playback to Safari's native fullscreen player with system controls. */
export function configureAppleNativePlayer(video: HTMLVideoElement): () => void {
  const el = video as VideoWithWebkit;
  el.controls = true;
  el.setAttribute("controls", "");
  el.setAttribute("playsinline", "true");
  el.setAttribute("webkit-playsinline", "true");

  const onPlay = () => enterAppleNativeFullscreen(video);

  video.addEventListener("play", onPlay);

  return () => {
    video.removeEventListener("play", onPlay);
  };
}
