import { isOfflineDownloadEnabled } from "@/lib/platform/offline-downloads";

export type ShortcutGroup = {
  title: string;
  items: { keys: string; description: string; nativeOnly?: boolean }[];
};

export function getPlatformShortcutGroups(): ShortcutGroup[] {
  const downloadsEnabled = isOfflineDownloadEnabled();

  return PLATFORM_SHORTCUT_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.nativeOnly || downloadsEnabled),
  }));
}

export const PLATFORM_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Browse & navigation",
    items: [
      { keys: "/", description: "Open search" },
      { keys: "Ctrl + K", description: "Open search" },
      { keys: "H", description: "Go to Home" },
      { keys: "M", description: "Open My List" },
      { keys: "D", description: "Open Downloads", nativeOnly: true },
      { keys: "Esc", description: "Close panel or go back" },
      { keys: "?", description: "Show keyboard shortcuts" },
    ],
  },
  {
    title: "Playback (while watching)",
    items: [
      { keys: "Space / K", description: "Play or pause" },
      { keys: "← / →", description: "Seek 10 seconds back / forward" },
      { keys: "↑ / ↓", description: "Volume up / down" },
      { keys: "J / L", description: "Seek 10 seconds back / forward" },
      { keys: "Shift + ← / →", description: "Seek 30 seconds" },
      { keys: "F", description: "Toggle fullscreen" },
      { keys: "M", description: "Mute or unmute" },
      { keys: "Esc / Back", description: "Exit player" },
    ],
  },
  {
    title: "TV remote & gamepad",
    items: [
      { keys: "D-pad / Arrow keys", description: "Move focus (browse); seek & volume while watching" },
      { keys: "Enter / A button", description: "Select focused item" },
      { keys: "Back / B button", description: "Go back or close" },
      { keys: "Play/Pause", description: "Control playback while watching" },
      { keys: "Left / Right bumper", description: "Seek 30 seconds while watching" },
    ],
  },
];

export function matchesShortcut(event: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split("+").map((p) => p.trim());
  const keyPart = parts[parts.length - 1]!;
  const needsCtrl = parts.includes("ctrl");
  const needsMeta = parts.includes("meta") || parts.includes("cmd");
  const needsShift = parts.includes("shift");
  const needsAlt = parts.includes("alt");

  const key = event.key.toLowerCase();
  const code = event.code.toLowerCase();

  let keyMatch = false;
  if (keyPart === "?") keyMatch = event.key === "?" || (event.key === "/" && event.shiftKey);
  else if (keyPart === "/") keyMatch = event.key === "/" && !event.ctrlKey && !event.metaKey;
  else if (keyPart === "esc" || keyPart === "escape") keyMatch = event.key === "Escape";
  else if (keyPart.length === 1) keyMatch = key === keyPart || code === `key${keyPart}`;
  else keyMatch = key === keyPart || code === keyPart;

  return (
    keyMatch &&
    event.ctrlKey === needsCtrl &&
    event.metaKey === needsMeta &&
    event.shiftKey === needsShift &&
    event.altKey === needsAlt
  );
}
