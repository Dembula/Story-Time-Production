const OVERLAY_ID = "storytime-nav-overlay";
const SKIP_ENTER_KEY = "storytime-skip-route-enter";

/** Opaque cover while the next route is loading — avoids a blank flash after watch/detail exit. */
export function showNavExitOverlay(): void {
  if (typeof document === "undefined") return;
  let el = document.getElementById(OVERLAY_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.setAttribute("aria-hidden", "true");
    el.className = "fixed inset-0 z-[9999] bg-[#0a0a0a]";
    document.body.appendChild(el);
  }
}

export function dismissNavOverlay(): void {
  if (typeof document === "undefined") return;
  document.getElementById(OVERLAY_ID)?.remove();
}

export function markSkipRouteEnterAnimation(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SKIP_ENTER_KEY, "1");
  } catch {
    // private mode / quota
  }
}

export function consumeSkipRouteEnterAnimation(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const skip = sessionStorage.getItem(SKIP_ENTER_KEY) === "1";
    sessionStorage.removeItem(SKIP_ENTER_KEY);
    return skip;
  } catch {
    return false;
  }
}

export function beginBrowseNavigation(): void {
  showNavExitOverlay();
  markSkipRouteEnterAnimation();
}
