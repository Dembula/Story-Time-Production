/** Normalize TV / set-top / console remote keys across vendors. */
export type RemoteAction =
  | "nav_up"
  | "nav_down"
  | "nav_left"
  | "nav_right"
  | "select"
  | "back"
  | "play_pause"
  | "stop"
  | "rewind"
  | "fast_forward"
  | "channel_up"
  | "channel_down";

const BACK_KEYS = new Set([
  "Escape",
  "Backspace",
  "BrowserBack",
  "GoBack",
  "XF86Back",
  "Exit",
  "Return",
]);

const BACK_KEY_CODES = new Set([
  461, // Samsung / many smart TVs
  10009, // Tizen
  27, // Escape legacy
  8, // Backspace legacy
]);

const SELECT_KEYS = new Set(["Enter", "NumpadEnter", "Select"]);

const PLAY_PAUSE_KEYS = new Set([
  "MediaPlayPause",
  "MediaPlay",
  "MediaPause",
  "Play",
  "Pause",
  " ", // Some remotes map to space
]);

const REWIND_KEYS = new Set(["MediaTrackPrevious", "MediaRewind", "Rewind"]);
const FORWARD_KEYS = new Set(["MediaTrackNext", "MediaFastForward", "FastForward"]);
const STOP_KEYS = new Set(["MediaStop", "Stop"]);

export function mapKeyboardToRemoteAction(event: KeyboardEvent): RemoteAction | null {
  const { key, code } = event;

  if (key === "ArrowUp") return "nav_up";
  if (key === "ArrowDown") return "nav_down";
  if (key === "ArrowLeft") return "nav_left";
  if (key === "ArrowRight") return "nav_right";

  if (SELECT_KEYS.has(key)) return "select";
  if (BACK_KEYS.has(key) || BACK_KEY_CODES.has(event.keyCode)) return "back";

  if (PLAY_PAUSE_KEYS.has(key) || PLAY_PAUSE_KEYS.has(code)) return "play_pause";
  if (REWIND_KEYS.has(key) || REWIND_KEYS.has(code)) return "rewind";
  if (FORWARD_KEYS.has(key) || FORWARD_KEYS.has(code)) return "fast_forward";
  if (STOP_KEYS.has(key) || STOP_KEYS.has(code)) return "stop";

  if (key === "PageUp" || key === "ChannelUp") return "channel_up";
  if (key === "PageDown" || key === "ChannelDown") return "channel_down";

  return null;
}

export function isLikelyRemoteKey(event: KeyboardEvent): boolean {
  return mapKeyboardToRemoteAction(event) !== null;
}
