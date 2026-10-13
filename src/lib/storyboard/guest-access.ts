import { randomBytes } from "crypto";
import {
  STORYBOARD_GUEST_DURATIONS,
  durationLabel,
  expiresAtForDuration,
  guestInvitePath,
  isStoryboardGuestDurationKey,
  type StoryboardGuestDurationKey,
} from "@/lib/storyboard/guest-durations";

export const STORYBOARD_GUEST_COOKIE = "st_storyboard_guest";

export {
  STORYBOARD_GUEST_DURATIONS,
  durationLabel,
  expiresAtForDuration,
  guestInvitePath,
  isStoryboardGuestDurationKey,
  type StoryboardGuestDurationKey,
};

export function newStoryboardInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newStoryboardGuestSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isStoryboardInviteActive(invite: {
  revokedAt?: Date | string | null;
  expiresAt?: Date | string | null;
}): boolean {
  if (invite.revokedAt) return false;
  if (!invite.expiresAt) return true;
  return new Date(invite.expiresAt).getTime() > Date.now();
}

export function isStoryboardGuestSessionActive(session: {
  expiresAt?: Date | string | null;
}): boolean {
  if (!session.expiresAt) return true;
  return new Date(session.expiresAt).getTime() > Date.now();
}
