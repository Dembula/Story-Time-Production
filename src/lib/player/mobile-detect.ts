/** Touch-first phones/tablets — used for Netflix-style watch UI and orientation lock. */
export function computeIsMobileLikeClient(): boolean {
  if (typeof window === "undefined") return false;
  const profile = computePlaybackDeviceProfileClient();
  return profile.isMobileLike;
}

export type PlaybackDeviceProfile = {
  family: "ios" | "android" | "desktop" | "tv" | "unknown";
  browser: "safari" | "chrome" | "samsung" | "edge" | "firefox" | "other";
  isMobileLike: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isTablet: boolean;
  isTvLike: boolean;
  prefersNativeFullscreen: boolean;
  playsInline: boolean;
  canAutoplayAudible: boolean;
  startHint: string;
  /** Netflix-style overlay controls (phones / small touch screens). */
  useTouchControls: boolean;
};

export function computePlaybackDeviceProfileClient(): PlaybackDeviceProfile {
  if (typeof window === "undefined") {
    return {
      family: "unknown",
      browser: "other",
      isMobileLike: false,
      isIOS: false,
      isAndroid: false,
      isTablet: false,
      isTvLike: false,
      prefersNativeFullscreen: false,
      playsInline: true,
      canAutoplayAudible: false,
      startHint: "Tap play to start playback.",
      useTouchControls: false,
    };
  }

  const ua = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const maxTouchPoints =
    typeof window.navigator.maxTouchPoints === "number" ? window.navigator.maxTouchPoints : 0;
  const isIPadOsDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || isIPadOsDesktopMode;
  const isAndroid = /Android/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua) || isIPadOsDesktopMode || (isAndroid && !/Mobile/i.test(ua));
  const isTvLike = /SmartTV|Tizen|Web0S|WebOS|AppleTV|GoogleTV|Android TV|CrKey/i.test(ua);
  const coarse =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;
  const isMobileLike = isIOS || isAndroid || coarse || window.innerWidth < 900;
  const useTouchControls =
    isIOS || isAndroid || (isMobileLike && coarse && window.innerWidth < 768);

  const browser: PlaybackDeviceProfile["browser"] = /SamsungBrowser/i.test(ua)
    ? "samsung"
    : /Edg\//i.test(ua)
      ? "edge"
      : /CriOS|Chrome/i.test(ua) && !/Edg\//i.test(ua)
        ? "chrome"
        : /Firefox|FxiOS/i.test(ua)
          ? "firefox"
          : /Safari/i.test(ua)
            ? "safari"
            : "other";

  const family: PlaybackDeviceProfile["family"] = isTvLike
    ? "tv"
    : isIOS
      ? "ios"
      : isAndroid
        ? "android"
        : "desktop";

  // Always play inside the page — never hand off to the OS media player.
  const prefersNativeFullscreen = false;
  const canAutoplayAudible = !isMobileLike && !isTvLike;

  return {
    family,
    browser,
    isMobileLike,
    isIOS,
    isAndroid,
    isTablet,
    isTvLike,
    prefersNativeFullscreen,
    playsInline: true,
    canAutoplayAudible,
    useTouchControls,
    startHint: isIOS
      ? "Tap play to start playback."
      : isAndroid
        ? browser === "samsung"
          ? "Tap play to start playback."
          : "Tap play to start playback."
        : "Tap play to start playback.",
  };
}
