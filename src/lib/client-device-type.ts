/** Prefer explicit native-app platform headers when present (Universe / Creators apps). */
export function inferDeviceTypeFromPlatformHeader(platform: string | null | undefined): string | null {
  if (!platform || typeof platform !== "string") return null;
  const p = platform.trim().toLowerCase();
  if (!p) return null;
  if (p === "ios_ipad" || p === "ipad" || p === "android_tablet") return "tablet";
  if (
    p === "ios_iphone" ||
    p === "ios" ||
    p === "iphone" ||
    p === "android" ||
    p === "android_phone" ||
    p.startsWith("ios_")
  ) {
    return "mobile";
  }
  if (p === "tv" || p === "android_tv" || p === "apple_tv" || p === "fire_tv" || p === "tizen" || p === "webos") {
    return "tv";
  }
  if (p === "web" || p === "desktop" || p === "browser") return "desktop";
  return null;
}

/** Coarse device class from User-Agent (aligned with admin analytics buckets). */
export function inferDeviceTypeFromUserAgent(ua: string | null | undefined): string {
  if (!ua || typeof ua !== "string") return "unknown";
  const s = ua.toLowerCase();
  if (/smart-tv|smarttv|googletv|appletv|hbbtv|tizen|web0s|roku|aftb|aftm|aftt|crkey|bravia|playstation|xbox/.test(s)) {
    return "tv";
  }
  // Native Story Time Universe / Creators shells identify themselves in UA.
  if (/storytimeuniverseios|storytimecreatorsios|storytime.*ios/.test(s)) {
    if (/ipad|tablet/.test(s)) return "tablet";
    return "mobile";
  }
  if (/storytime.*android|okhttp|dalvik/.test(s) && /mobile|android/.test(s)) {
    if (/tablet|sm-t|pad/.test(s)) return "tablet";
    return "mobile";
  }
  if (/ipad|tablet|playbook|silk|kindle/.test(s) || (s.includes("android") && !s.includes("mobile"))) {
    return "tablet";
  }
  if (/iphone|ipod|android.*mobile|webos|blackberry|opera mini|iemobile|wpdesktop/.test(s)) {
    return "mobile";
  }
  if (/windows nt|macintosh|x11|linux|cros/.test(s)) {
    return "desktop";
  }
  return "unknown";
}
