/**
 * Offline downloads are a native-app-only feature (App Store / Play Store builds).
 * Web users never see download navigation or detail-page actions.
 *
 * Enable in native builds via NEXT_PUBLIC_NATIVE_OFFLINE_DOWNLOADS=true
 * or Capacitor when that shell is wired up.
 */
export function isOfflineDownloadEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_NATIVE_OFFLINE_DOWNLOADS === "true") {
    return true;
  }

  if (typeof window !== "undefined") {
    const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (capacitor?.isNativePlatform?.()) {
      return true;
    }
  }

  return false;
}
