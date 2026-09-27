import { randomBytes } from "crypto";
import type { EditReviewGuestDurationKey } from "./guest-durations";

export const EDIT_REVIEW_GUEST_COOKIE = "st_edit_review_guest";

export {
  EDIT_REVIEW_GUEST_DURATIONS,
  durationLabel,
  expiresAtForDuration,
  guestInvitePath,
  isEditReviewGuestDurationKey,
  type EditReviewGuestDurationKey,
} from "./guest-durations";

export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newGuestSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isInviteActive(invite: {
  revokedAt?: Date | string | null;
  expiresAt?: Date | string | null;
}): boolean {
  if (invite.revokedAt) return false;
  if (!invite.expiresAt) return true;
  return new Date(invite.expiresAt).getTime() > Date.now();
}

export function isSessionActive(session: {
  expiresAt?: Date | string | null;
}): boolean {
  if (!session.expiresAt) return true;
  return new Date(session.expiresAt).getTime() > Date.now();
}
