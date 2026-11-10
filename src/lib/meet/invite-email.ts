import { absoluteMeetGuestUrl } from "@/lib/meet/codes";
import {
  buildGoogleCalendarUrl,
  buildMeetIcs,
  buildOutlookCalendarUrl,
  resolveMeetWindow,
} from "@/lib/meet/ics";

export function buildMeetInviteEmail(input: {
  hostName: string;
  title: string;
  code: string;
  meetingId: string;
  passcode?: string | null;
  scheduledAt?: Date | string | null;
  durationMinutes?: number;
}) {
  // Deep link: code (+ passcode when set) live in the URL — guests tap Join, no code typing.
  const guestUrl = absoluteMeetGuestUrl(input.code, undefined, { passcode: input.passcode });
  const { startAt, endAt } = resolveMeetWindow({
    scheduledAt: input.scheduledAt,
    durationMinutes: input.durationMinutes,
  });
  const when = input.scheduledAt
    ? startAt.toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short",
      })
    : "Starting now / join when ready";

  const calInput = {
    meetingId: input.meetingId,
    title: input.title,
    code: input.code,
    passcode: input.passcode,
    hostName: input.hostName,
    startAt,
    endAt,
  };
  const googleCalUrl = buildGoogleCalendarUrl(calInput);
  const outlookCalUrl = buildOutlookCalendarUrl(calInput);
  const ics = buildMeetIcs(calInput);

  const text = [
    `${input.hostName} invited you to a Story Time Meet.`,
    "",
    `Meeting: ${input.title}`,
    `When: ${when}`,
    "",
    "Tap the join link below — the meeting is already selected for you.",
    "You’ll land in the lobby, enter your name, and press Join now.",
    "No need to type a meeting code.",
    "",
    `Join now: ${guestUrl}`,
    "",
    `Meeting code (only if you join without this link): ${input.code}`,
    input.passcode ? `Passcode (included in your link): ${input.passcode}` : null,
    "",
    "Save to your calendar:",
    `Google Calendar: ${googleCalUrl}`,
    `Outlook: ${outlookCalUrl}`,
    "(An .ics calendar file is also attached to this email.)",
    "",
    "No Story Time account is required for guests.",
    "Open the link, check your camera/mic in the lobby, then wait for the host to admit you.",
    "Meetings support up to 20 people.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a0b;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px;">
              <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#fdba74;font-family:Arial,sans-serif;">Story Time Meet</div>
              <h1 style="margin:12px 0 0;font-size:26px;line-height:1.25;color:#fff;">You're invited</h1>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#94a3b8;">
                <strong style="color:#e2e8f0;">${escapeHtml(input.hostName)}</strong>
                invited you to
                <strong style="color:#fff;">${escapeHtml(input.title)}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 20px;">
              <table role="presentation" width="100%" style="background:#0a0a0b;border:1px solid rgba(255,255,255,0.06);border-radius:14px;">
                <tr>
                  <td style="padding:16px 18px;font-family:Arial,sans-serif;">
                    <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">When</div>
                    <div style="margin-top:6px;font-size:14px;color:#e2e8f0;">${escapeHtml(when)}</div>
                    <div style="margin-top:14px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">How to join</div>
                    <div style="margin-top:6px;font-size:14px;color:#e2e8f0;line-height:1.5;">
                      Tap <strong style="color:#fdba74;">Join now</strong> — the meeting is already in the link. No code to type.
                    </div>
                    ${
                      input.passcode
                        ? `<div style="margin-top:14px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">Passcode</div>
                    <div style="margin-top:6px;font-size:13px;color:#94a3b8;">Included in your join link for you.</div>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 20px;" align="center">
              <a href="${guestUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;font-weight:600;padding:14px 28px;border-radius:12px;">
                Join now
              </a>
              <p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#64748b;font-family:Arial,sans-serif;">
                Opens the Story Time Meet lobby — check camera &amp; mic, enter your name, then join.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;" align="center">
              <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;margin-bottom:10px;">Save to calendar</div>
              <a href="${googleCalUrl}" style="display:inline-block;margin:0 4px 8px;background:rgba(255,255,255,0.06);color:#e2e8f0;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;font-weight:600;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);">
                Google Calendar
              </a>
              <a href="${outlookCalUrl}" style="display:inline-block;margin:0 4px 8px;background:rgba(255,255,255,0.06);color:#e2e8f0;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;font-weight:600;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);">
                Outlook
              </a>
              <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:#64748b;font-family:Arial,sans-serif;">
                An <strong style="color:#94a3b8;">.ics</strong> file is attached — open it to add this Meet to Apple Calendar, Outlook, or any calendar app.
              </p>
              <p style="margin:14px 0 0;font-size:11px;color:#475569;font-family:Arial,sans-serif;">
                Backup code if you don’t have the link: <span style="color:#94a3b8;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(input.code)}</span>
              </p>
              <p style="margin:10px 0 0;font-size:11px;color:#475569;word-break:break-all;font-family:Arial,sans-serif;">
                ${escapeHtml(guestUrl)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: `Story Time Meet: ${input.title}`,
    text,
    html,
    guestUrl,
    ics,
    googleCalUrl,
    outlookCalUrl,
    startAt,
    endAt,
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
