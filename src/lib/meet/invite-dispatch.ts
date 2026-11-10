import { prisma } from "@/lib/prisma";
import { generateMeetInviteToken } from "@/lib/meet/codes";
import { buildMeetInviteEmail } from "@/lib/meet/invite-email";
import {
  isEmailTransportConfigured,
  sendTransactionalEmailDetailed,
  type SendEmailResult,
} from "@/lib/email";
import { notifyUser } from "@/lib/notify-user";

/** Extract a bare email from free-text (handles "Name <a@b.com>" and mailto:). */
export function normalizeInviteEmail(raw: string): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  const angle = s.match(/<([^>\s]+@[^>\s]+)>/);
  const candidate = (angle?.[1] || s.replace(/^mailto:/i, "")).trim();
  // Practical validation — don't reject common real-world addresses.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(candidate)) return null;
  if (candidate.length > 254) return null;
  return candidate.toLowerCase();
}

export function parseInviteEmailList(raw: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(raw)
    ? raw.map(String)
    : String(raw ?? "")
        .split(/[,;\n\r]+/)
        .flatMap((chunk) => chunk.trim().split(/\s+/));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const email = normalizeInviteEmail(part);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
    if (out.length >= 40) break;
  }
  return out;
}

export type MeetInviteSendResult = {
  email: string;
  inviteId: string;
  sent: boolean;
  provider?: string;
  error?: string;
  invitedUserId?: string | null;
};

/**
 * Deliver a Meet invite as one email: HTML body + .ics attachment.
 * If a provider rejects the calendar attachment, retry once as HTML-only
 * (still a single message — never send a separate ICS follow-up).
 */
export async function sendMeetInviteMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
  ics?: { filename: string; contentType: string; body: string } | null;
}): Promise<SendEmailResult> {
  if (!isEmailTransportConfigured()) {
    return {
      ok: false,
      error:
        "No email transport configured (set SENDGRID_API_KEY, RESEND_API_KEY, or EMAIL_SERVER).",
    };
  }

  const icsFilename = input.ics?.body
    ? input.ics.filename.endsWith(".ics")
      ? input.ics.filename
      : `${input.ics.filename}.ics`
    : null;

  // Prefer a generic type + .ics filename so providers that reject text/calendar
  // still deliver the invite with the calendar file attached in the same message.
  const attachments =
    input.ics?.body && icsFilename
      ? [
          {
            filename: icsFilename,
            contentType: "application/octet-stream",
            content: input.ics.body,
          },
        ]
      : undefined;

  const withIcs = await sendTransactionalEmailDetailed({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    attachments,
  });
  if (withIcs.ok) return withIcs;

  if (attachments?.length) {
    console.warn(
      "[meet-invite] ICS attachment rejected; retrying HTML-only",
      input.to,
      withIcs.error,
    );
    const plain = await sendTransactionalEmailDetailed({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    if (plain.ok) return plain;
    console.error("[meet-invite] HTML invite failed", input.to, plain.error);
    return plain;
  }

  console.error("[meet-invite] HTML invite failed", input.to, withIcs.error);
  return withIcs;
}

/**
 * Create MeetInvite rows and deliver guest emails.
 * Always returns per-recipient send status so the UI can surface failures.
 */
export async function dispatchMeetEmailInvites(input: {
  meeting: {
    id: string;
    title: string;
    code: string;
    passcode?: string | null;
    scheduledAt?: Date | null;
    startedAt?: Date | null;
  };
  hostUserId: string;
  hostName: string;
  emails: string[];
}): Promise<{
  results: MeetInviteSendResult[];
  sentCount: number;
  failedCount: number;
  guestUrl: string;
  googleCalUrl: string;
  outlookCalUrl: string;
  emailTransportConfigured: boolean;
}> {
  const emails = parseInviteEmailList(input.emails);
  const transportOk = isEmailTransportConfigured();
  const inviteEmail = buildMeetInviteEmail({
    hostName: input.hostName,
    title: input.meeting.title,
    code: input.meeting.code,
    meetingId: input.meeting.id,
    passcode: input.meeting.passcode,
    scheduledAt: input.meeting.scheduledAt ?? input.meeting.startedAt ?? new Date(),
  });

  const results: MeetInviteSendResult[] = [];

  for (const email of emails) {
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });

    const invite = await prisma.meetInvite.create({
      data: {
        meetingId: input.meeting.id,
        invitedByUserId: input.hostUserId,
        invitedUserId: existingUser?.id ?? null,
        email,
        token: generateMeetInviteToken(),
      },
    });

    let sendResult: SendEmailResult;
    try {
      sendResult = await sendMeetInviteMail({
        to: email,
        subject: inviteEmail.subject,
        text: inviteEmail.text,
        html: inviteEmail.html,
        ics: inviteEmail.ics,
      });
    } catch (err) {
      sendResult = {
        ok: false,
        error: err instanceof Error ? err.message : "Email send threw",
      };
    }

    if (!sendResult.ok) {
      console.error("[meet-invite] failed to send", email, sendResult.error);
    }

    results.push({
      email,
      inviteId: invite.id,
      sent: sendResult.ok,
      provider: sendResult.provider,
      error: sendResult.ok ? undefined : sendResult.error,
      invitedUserId: existingUser?.id ?? null,
    });

    if (existingUser?.id) {
      await notifyUser({
        userId: existingUser.id,
        type: "meet_invite",
        title: "Story Time Meet invite",
        body: `${input.hostName} invited you to “${input.meeting.title}”. Join from your invite link.`,
        metadata: {
          meetingId: input.meeting.id,
          code: input.meeting.code,
          href: `/creator/meet/room/${input.meeting.id}`,
          guestUrl: inviteEmail.guestUrl,
          googleCalUrl: inviteEmail.googleCalUrl,
          outlookCalUrl: inviteEmail.outlookCalUrl,
        },
        ...(sendResult.ok
          ? {}
          : {
              email: {
                subject: inviteEmail.subject,
                text: inviteEmail.text,
                html: inviteEmail.html,
              },
            }),
      });
    }
  }

  return {
    results,
    sentCount: results.filter((r) => r.sent).length,
    failedCount: results.filter((r) => !r.sent).length,
    guestUrl: inviteEmail.guestUrl,
    googleCalUrl: inviteEmail.googleCalUrl,
    outlookCalUrl: inviteEmail.outlookCalUrl,
    emailTransportConfigured: transportOk,
  };
}
