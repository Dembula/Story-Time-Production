const PLAY_INTENT_KEY = "storytime-play-intent";
const PLAY_INTENT_MAX_MS = 5000;

/** Call from the detail-page Play button so the watch player can start ASAP after navigation. */
export function markPlaybackPlayIntent(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PLAY_INTENT_KEY, String(Date.now()));
  } catch {
    // private mode / blocked storage
  }
}

export function consumePlaybackPlayIntent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(PLAY_INTENT_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(PLAY_INTENT_KEY);
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts <= PLAY_INTENT_MAX_MS;
  } catch {
    return false;
  }
}

export function enterWatchContainerFullscreen(root?: HTMLElement | null): void {
  if (typeof document === "undefined") return;
  const el =
    root ??
    (document.querySelector(".storytime-watch-player") as HTMLElement | null);
  if (!el || document.fullscreenElement) return;
  const requestFs =
    el.requestFullscreen?.bind(el) ??
    (el as unknown as { webkitRequestFullscreen?: () => Promise<void> | void })
      .webkitRequestFullscreen?.bind(el);
  if (!requestFs) return;
  void Promise.resolve(requestFs()).catch(() => {});
}
