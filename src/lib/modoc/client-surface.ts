/**
 * Detect which Story Time client surface the VA is talking to.
 * Native shells set window.__STORYTIME_NATIVE_APP__ and/or Capacitor.
 */

export type ModocClientSurface =
  | "web_desktop"
  | "web_tablet"
  | "web_mobile"
  | "native_ios"
  | "native_android"
  | "unknown";

type NativeAppWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
  __STORYTIME_NATIVE_APP__?: boolean;
  __STORYTIME_NATIVE_PLATFORM__?: string;
};

export function detectModocClientSurface(): ModocClientSurface {
  if (typeof window === "undefined") return "unknown";

  const w = window as NativeAppWindow;
  const nativeFlag = w.__STORYTIME_NATIVE_APP__ === true;
  const capacitorNative = Boolean(w.Capacitor?.isNativePlatform?.());
  const platformHint = (
    w.__STORYTIME_NATIVE_PLATFORM__ ||
    w.Capacitor?.getPlatform?.() ||
    ""
  ).toLowerCase();

  if (nativeFlag || capacitorNative) {
    if (platformHint.includes("ios") || platformHint === "iphone" || platformHint === "ipad") {
      return "native_ios";
    }
    if (platformHint.includes("android")) {
      return "native_android";
    }
    // Native but platform unknown — still treat as mobile app.
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return "native_ios";
    if (/Android/i.test(ua)) return "native_android";
    return "native_android";
  }

  const width = window.innerWidth || 0;
  if (width > 0 && width < 768) return "web_mobile";
  if (width >= 768 && width < 1024) return "web_tablet";
  if (width >= 1024) return "web_desktop";

  const ua = navigator.userAgent || "";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "web_mobile";
  if (/iPad|Tablet/i.test(ua)) return "web_tablet";
  return "web_desktop";
}

export function describeClientSurface(surface: ModocClientSurface): string {
  switch (surface) {
    case "web_desktop":
      return "Desktop web browser — full creator tool access.";
    case "web_tablet":
      return "Tablet web browser — most tools available; heavy studios may be tighter.";
    case "web_mobile":
      return "Mobile web browser — tools available but heavy studios are better on desktop.";
    case "native_ios":
      return "Story Time iOS app — updates / light status; direct full studio work to web.";
    case "native_android":
      return "Story Time Android app — updates / light status; direct full studio work to web.";
    default:
      return "Surface unknown — assume web and offer desktop for heavy tools when needed.";
  }
}
