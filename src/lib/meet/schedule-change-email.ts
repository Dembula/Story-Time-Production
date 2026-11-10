import { absoluteMeetGuestUrl } from "@/lib/meet/codes";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWhen(value: Date | string | null | undefined) {
  if (!value) return "Time TBD";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Time TBD";
  return d.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });
}

/** Email for rescheduled or cancelled Meet invites. */
export function buildMeetScheduleChangeEmail(input: {
  hostName: string;
  title: string;
  code: string;
  passcode?: string | null;
  kind: "rescheduled" | "cancelled";
  previousScheduledAt?: Date | string | null;
  scheduledAt?: Date | string | null;
}) {
  const guestUrl = absoluteMeetGuestUrl(input.code, undefined, { passcode: input.passcode });
  const when = formatWhen(input.scheduledAt);
  const previous = formatWhen(input.previousScheduledAt);

  if (input.kind === "cancelled") {
    const subject = `Cancelled: Story Time Meet — ${input.title}`;
    const text = [
      `${input.hostName} cancelled a Story Time Meet.`,
      "",
      `Meeting: ${input.title}`,
      `Was scheduled for: ${previous}`,
      `Meeting code: ${input.code}`,
      "",
      "You no longer need to join this meeting.",
    ].join("\n");
    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0b;font-family:Arial,sans-serif;">
  <table width="100%" style="background:#0a0a0b;padding:32px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:560px;background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:20px;">
      <tr><td style="padding:28px;">
        <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#fdba74;">Story Time Meet</div>
        <h1 style="margin:12px 0 0;font-size:24px;color:#fff;">Meeting cancelled</h1>
        <p style="margin:12px 0 0;font-size:14px;line-height:1.55;color:#94a3b8;">
          <strong style="color:#e2e8f0;">${escapeHtml(input.hostName)}</strong> cancelled
          <strong style="color:#fff;">${escapeHtml(input.title)}</strong>.
        </p>
        <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Was scheduled for ${escapeHtml(previous)}.</p>
        <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">You no longer need to join.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
    return { subject, text, html, guestUrl };
  }

  const subject = `Updated time: Story Time Meet — ${input.title}`;
  const text = [
    `${input.hostName} updated a Story Time Meet.`,
    "",
    `Meeting: ${input.title}`,
    `Previously: ${previous}`,
    `New time: ${when}`,
    "",
    `Join link: ${guestUrl}`,
    `Meeting code: ${input.code}`,
  ].join("\n");
  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a0a0b;font-family:Arial,sans-serif;">
  <table width="100%" style="background:#0a0a0b;padding:32px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:560px;background:#121214;border:1px solid rgba(255,255,255,0.08);border-radius:20px;">
      <tr><td style="padding:28px;">
        <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#fdba74;">Story Time Meet</div>
        <h1 style="margin:12px 0 0;font-size:24px;color:#fff;">Meeting rescheduled</h1>
        <p style="margin:12px 0 0;font-size:14px;line-height:1.55;color:#94a3b8;">
          <strong style="color:#e2e8f0;">${escapeHtml(input.hostName)}</strong> updated
          <strong style="color:#fff;">${escapeHtml(input.title)}</strong>.
        </p>
        <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Was: ${escapeHtml(previous)}</p>
        <p style="margin:8px 0 0;font-size:15px;color:#e2e8f0;"><strong>New time:</strong> ${escapeHtml(when)}</p>
        <p style="margin:22px 0 0;" align="center">
          <a href="${guestUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:12px;">Join now</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject, text, html, guestUrl };
}
