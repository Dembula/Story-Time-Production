import { randomBytes } from "crypto";
import {
  SCRIPT_REVIEW_GUEST_DURATIONS,
  durationLabel,
  expiresAtForDuration,
  isScriptReviewGuestDurationKey,
  type ScriptReviewGuestDurationKey,
} from "@/lib/script-review/guest-durations";

export const SCRIPT_REVIEW_GUEST_COOKIE = "st_script_review_guest";

export {
  SCRIPT_REVIEW_GUEST_DURATIONS,
  durationLabel,
  expiresAtForDuration,
  isScriptReviewGuestDurationKey,
  type ScriptReviewGuestDurationKey,
};

export function newScriptInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newScriptGuestSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function scriptGuestInvitePath(token: string): string {
  return `/script-review/guest/${encodeURIComponent(token)}`;
}

export function isScriptInviteActive(invite: {
  revokedAt?: Date | string | null;
  expiresAt?: Date | string | null;
}): boolean {
  if (invite.revokedAt) return false;
  if (!invite.expiresAt) return true;
  return new Date(invite.expiresAt).getTime() > Date.now();
}

export function isScriptGuestSessionActive(session: {
  expiresAt?: Date | string | null;
}): boolean {
  if (!session.expiresAt) return true;
  return new Date(session.expiresAt).getTime() > Date.now();
}
