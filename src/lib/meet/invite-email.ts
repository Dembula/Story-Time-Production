import { absoluteMeetGuestUrl } from "@/lib/meet/codes";

export function buildMeetInviteEmail(input: {
  hostName: string;
  title: string;
  code: string;
  passcode?: string | null;
  scheduledAt?: Date | string | null;
}) {
  const guestUrl = absoluteMeetGuestUrl(input.code);
  const when = input.scheduledAt
    ? new Date(input.scheduledAt).toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short",
      })
    : "Starting now / join when ready";

  const text = [
    `${input.hostName} invited you to a Story Time Meet.`,
    "",
    `Meeting: ${input.title}`,
    `When: ${when}`,
    "",
    `Join link: ${guestUrl}`,
    `Meeting code: ${input.code}`,
    input.passcode ? `Passcode: ${input.passcode}` : null,
    "",
    "No Story Time account is required for guests.",
    "Open the link, enter your name, and wait for the host to admit you.",
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
                    <div style="margin-top:14px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">Meeting code</div>
                    <div style="margin-top:6px;font-size:20px;letter-spacing:0.08em;color:#fdba74;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(input.code)}</div>
                    ${
                      input.passcode
                        ? `<div style="margin-top:14px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;">Passcode</div>
                    <div style="margin-top:6px;font-size:18px;letter-spacing:0.12em;color:#fff;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(input.passcode)}</div>`
                        : ""
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;" align="center">
              <a href="${guestUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:600;padding:12px 22px;border-radius:12px;">
                Join Story Time Meet
              </a>
              <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#64748b;font-family:Arial,sans-serif;">
                Guests don’t need an account. Open the link, enter your name${
                  input.passcode ? " and passcode" : ""
                }, then wait in the lobby until the host admits you.
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
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
