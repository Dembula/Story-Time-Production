export const PLAYBACK_COMMAND_EVENT = "storytime:playback-command";

export type PlaybackCommand =
  | "play_pause"
  | "seek_back"
  | "seek_forward"
  | "seek_back_large"
  | "seek_forward_large"
  | "volume_up"
  | "volume_down"
  | "mute_toggle"
  | "fullscreen_toggle"
  | "exit";

export function dispatchPlaybackCommand(action: PlaybackCommand): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PLAYBACK_COMMAND_EVENT, { detail: { action } }));
}

export function isPlayerScopeActive(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector('[data-input-scope="player"]'));
}

export function closeTopOverlay(): boolean {
  const selectors = [
    '[role="dialog"][data-state="open"]',
    '[data-modal-open="true"]',
    "[data-radix-dialog-content]",
  ];
  for (const sel of selectors) {
    const dialog = document.querySelector(sel);
    if (!dialog) continue;
    const closeBtn = dialog.parentElement?.querySelector<HTMLElement>(
      '[data-modal-close], [aria-label="Close"], button[aria-label="Close"]',
    );
    if (closeBtn) {
      closeBtn.click();
      return true;
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return true;
  }
  return false;
}
