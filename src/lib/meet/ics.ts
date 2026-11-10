import { absoluteMeetGuestUrl } from "@/lib/meet/codes";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Format a Date as UTC ICS timestamp: 20261110T163000Z */
export function toIcsUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldIcsLine(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length) {
    parts.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  return parts.join("\r\n");
}

export type MeetCalendarInput = {
  meetingId: string;
  title: string;
  code: string;
  passcode?: string | null;
  hostName?: string | null;
  startAt: Date;
  /** Defaults to 60 minutes after start. */
  endAt?: Date;
  descriptionExtra?: string | null;
};

export function resolveMeetWindow(input: {
  scheduledAt?: Date | string | null;
  startedAt?: Date | string | null;
  durationMinutes?: number;
}) {
  const start = new Date(input.scheduledAt || input.startedAt || Date.now());
  const mins = Math.max(15, Math.min(8 * 60, input.durationMinutes ?? 60));
  const end = new Date(start.getTime() + mins * 60 * 1000);
  return { startAt: start, endAt: end };
}

export function buildMeetIcs(input: MeetCalendarInput): {
  filename: string;
  contentType: string;
  body: string;
} {
  const guestUrl = absoluteMeetGuestUrl(input.code);
  const endAt = input.endAt ?? new Date(input.startAt.getTime() + 60 * 60 * 1000);
  const uid = `meet-${input.meetingId}@storytime`;
  const stamp = toIcsUtc(new Date());
  const description = [
    `Story Time Meet: ${input.title}`,
    input.hostName ? `Host: ${input.hostName}` : null,
    `Join: ${guestUrl}`,
    `Meeting code: ${input.code}`,
    input.passcode ? `Passcode: ${input.passcode}` : null,
    input.descriptionExtra || null,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Story Time//Meet//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(input.startAt)}`,
    `DTEND:${toIcsUtc(endAt)}`,
    `SUMMARY:${icsEscape(`Story Time Meet: ${input.title}`)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `URL:${guestUrl}`,
    `LOCATION:${icsEscape(guestUrl)}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const body = `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
  const safeTitle = input.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "meet";
  return {
    filename: `story-time-meet-${safeTitle}.ics`,
    contentType: "text/calendar; charset=utf-8",
    body,
  };
}

/** Google Calendar “Add event” deep link. */
export function buildGoogleCalendarUrl(input: MeetCalendarInput): string {
  const guestUrl = absoluteMeetGuestUrl(input.code);
  const endAt = input.endAt ?? new Date(input.startAt.getTime() + 60 * 60 * 1000);
  const details = [
    `Join: ${guestUrl}`,
    `Meeting code: ${input.code}`,
    input.passcode ? `Passcode: ${input.passcode}` : null,
    input.hostName ? `Host: ${input.hostName}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Story Time Meet: ${input.title}`,
    dates: `${toIcsUtc(input.startAt)}/${toIcsUtc(endAt)}`,
    details,
    location: guestUrl,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook.com web compose deep link. */
export function buildOutlookCalendarUrl(input: MeetCalendarInput): string {
  const guestUrl = absoluteMeetGuestUrl(input.code);
  const endAt = input.endAt ?? new Date(input.startAt.getTime() + 60 * 60 * 1000);
  const body = [
    `Join: ${guestUrl}`,
    `Meeting code: ${input.code}`,
    input.passcode ? `Passcode: ${input.passcode}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: `Story Time Meet: ${input.title}`,
    startdt: input.startAt.toISOString(),
    enddt: endAt.toISOString(),
    body,
    location: guestUrl,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
