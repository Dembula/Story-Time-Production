export const STORYBOARD_GUEST_DURATIONS = [
  { key: "1h", label: "1 hour", ms: 60 * 60 * 1000 },
  { key: "12h", label: "12 hours", ms: 12 * 60 * 60 * 1000 },
  { key: "1d", label: "1 day", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", label: "30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "90d", label: "90 days", ms: 90 * 24 * 60 * 60 * 1000 },
  { key: "indefinite", label: "Indefinitely", ms: null },
] as const;

export type StoryboardGuestDurationKey =
  (typeof STORYBOARD_GUEST_DURATIONS)[number]["key"];

export function isStoryboardGuestDurationKey(
  value: string,
): value is StoryboardGuestDurationKey {
  return STORYBOARD_GUEST_DURATIONS.some((d) => d.key === value);
}

export function expiresAtForDuration(
  durationKey: StoryboardGuestDurationKey,
  from = new Date(),
): Date | null {
  const match = STORYBOARD_GUEST_DURATIONS.find((d) => d.key === durationKey);
  if (!match || match.ms == null) return null;
  return new Date(from.getTime() + match.ms);
}

export function durationLabel(durationKey: string): string {
  return STORYBOARD_GUEST_DURATIONS.find((d) => d.key === durationKey)?.label ?? durationKey;
}

export function guestInvitePath(token: string): string {
  return `/storyboard/guest/${encodeURIComponent(token)}`;
}
