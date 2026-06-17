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

/** Safari native fullscreen — iOS only, must be called from a user gesture. */
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

export function exitAppleNativeFullscreen(video: HTMLVideoElement | null | undefined): void {
  if (!video) return;
  const el = video as VideoWithWebkit;
  if (!el.webkitDisplayingFullscreen) return;
  if (typeof el.webkitExitFullscreen === "function") {
    try {
      el.webkitExitFullscreen();
    } catch {
      // unsupported or denied
    }
  }
}

export function isVideoWebkitFullscreen(video: HTMLVideoElement | null | undefined): boolean {
  if (!video) return false;
  return Boolean((video as VideoWithWebkit).webkitDisplayingFullscreen);
}

/** iOS only: inline playback — Storytime custom controls handle transport and fullscreen. */
export function configureAppleNativePlayer(video: HTMLVideoElement): () => void {
  video.controls = false;
  video.removeAttribute("controls");
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.playsInline = true;
  return () => {};
}
