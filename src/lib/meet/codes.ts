import { randomBytes } from "crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Short human-friendly join code (e.g. ST-7K2M9Q). */
export function generateMeetCode(): string {
  const bytes = randomBytes(6);
  let body = "";
  for (let i = 0; i < 6; i++) {
    body += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `ST-${body}`;
}

export function generateMeetInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function generateMeetGuestSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateMeetPeerId(prefix: "u" | "g" = "u"): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function meetGuestPath(code: string, opts?: { passcode?: string | null }): string {
  const path = `/meet/${encodeURIComponent(code)}`;
  const passcode = opts?.passcode?.trim();
  if (!passcode) return path;
  return `${path}?passcode=${encodeURIComponent(passcode)}`;
}

export function meetRoomPath(meetingId: string): string {
  return `/creator/meet/room/${encodeURIComponent(meetingId)}`;
}

/** Deep link into the guest lobby — code (and optional passcode) are in the URL so guests never re-type them. */
export function absoluteMeetGuestUrl(
  code: string,
  origin?: string,
  opts?: { passcode?: string | null },
): string {
  const base =
    origin?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://story-time.online";
  return `${base}${meetGuestPath(code, opts)}`;
}
