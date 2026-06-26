type NativeAppWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
  /** Set by Story Time iOS/Android shells — never set in a normal browser. */
  __STORYTIME_NATIVE_APP__?: boolean;
};

/**
 * Offline downloads are only available inside the native iOS/Android app shell.
 * Web browsers (mobile Safari, Chrome, iPad, desktop) always get false — even if
 * NEXT_PUBLIC_* env vars are set on Vercel for the same deployment URL.
 */
export function isOfflineDownloadEnabled(): boolean {
  if (typeof window === "undefined") return false;

  const nativeWindow = window as NativeAppWindow;
  if (nativeWindow.__STORYTIME_NATIVE_APP__ === true) return true;

  return Boolean(nativeWindow.Capacitor?.isNativePlatform?.());
}

/** Client hook — re-checks after mount so Capacitor injection is detected. */
export function useOfflineDownloadEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return isOfflineDownloadEnabled();
}
