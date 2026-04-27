/** Coarse device class from User-Agent (aligned with admin analytics buckets). */
export function inferDeviceTypeFromUserAgent(ua: string | null | undefined): string {
  if (!ua || typeof ua !== "string") return "unknown";
  const s = ua.toLowerCase();
  if (/smart-tv|smarttv|googletv|appletv|hbbtv|tizen|web0s|roku|aftb|aftm|aftt|crkey|bravia|playstation|xbox/.test(s)) {
    return "tv";
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
