/** Touch-first phones/tablets — used for Netflix-style watch UI and orientation lock. */
export function computeIsMobileLikeClient(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (platform === "MacIntel" &&
      typeof window.navigator.maxTouchPoints === "number" &&
      window.navigator.maxTouchPoints > 1);
  const coarse =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;
  return isIOS || coarse || window.innerWidth < 900;
}
