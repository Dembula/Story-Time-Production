import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";
import { generateMeetInviteToken } from "@/lib/meet/codes";
import { buildMeetInviteEmail } from "@/lib/meet/invite-email";
import {
  dispatchMeetEmailInvites,
  parseInviteEmailList,
  sendMeetInviteMail,
} from "@/lib/meet/invite-dispatch";
import { isEmailTransportConfigured } from "@/lib/email";
import { notifyUser } from "@/lib/notify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meeting = await resolveMeetByIdOrCode(id);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (meeting.hostUserId !== session.userId) {
    return NextResponse.json({ error: "Only the host can invite" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    userIds?: string[];
    emails?: string[];
  } | null;

  const userIds = Array.isArray(body?.userIds)
    ? [...new Set(body!.userIds.map(String).filter(Boolean))]
    : [];
  const emails = parseInviteEmailList(body?.emails);

  if (!userIds.length && !emails.length) {
    return NextResponse.json(
      {
        error:
          "Add at least one email address or select someone from your network.",
      },
      { status: 400 },
    );
  }

  const inviteEmail = buildMeetInviteEmail({
    hostName: session.name,
    title: meeting.title,
    code: meeting.code,
    meetingId: meeting.id,
    passcode: meeting.passcode,
    scheduledAt: meeting.scheduledAt ?? meeting.startedAt ?? new Date(),
  });

  const created: { id: string; email?: string | null; invitedUserId?: string | null }[] = [];
  const networkEmailResults: Array<{
    userId: string;
    email?: string | null;
    sent: boolean;
    error?: string;
  }> = [];

  for (const userId of userIds) {
    if (userId === session.userId) continue;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) continue;

    const invite = await prisma.meetInvite.create({
      data: {
        meetingId: meeting.id,
        invitedByUserId: session.userId,
        invitedUserId: userId,
        email: user.email?.toLowerCase() || null,
        token: generateMeetInviteToken(),
      },
    });
    created.push({ id: invite.id, invitedUserId: userId, email: user.email });

    await notifyUser({
      userId,
      type: "meet_invite",
      title: "Story Time Meet invite",
      body: `${session.name} invited you to “${meeting.title}”. Join from your invite link.`,
      metadata: {
        meetingId: meeting.id,
        code: meeting.code,
        href: `/creator/meet/room/${meeting.id}`,
        guestUrl: inviteEmail.guestUrl,
        googleCalUrl: inviteEmail.googleCalUrl,
        outlookCalUrl: inviteEmail.outlookCalUrl,
      },
    });

    if (user.email) {
      const sent = await sendMeetInviteMail({
        to: user.email,
        subject: inviteEmail.subject,
        text: inviteEmail.text,
        html: inviteEmail.html,
        ics: inviteEmail.ics,
      });
      networkEmailResults.push({
        userId,
        email: user.email,
        sent: sent.ok,
        error: sent.ok ? undefined : sent.error,
      });
      if (!sent.ok) {
        console.error("[meet-invite] network user email failed", user.email, sent.error);
      }
    } else {
      networkEmailResults.push({
        userId,
        email: null,
        sent: false,
        error: "User has no email on file (in-app invite only)",
      });
    }
  }

  let emailDispatch: Awaited<ReturnType<typeof dispatchMeetEmailInvites>> | null = null;
  if (emails.length) {
    emailDispatch = await dispatchMeetEmailInvites({
      meeting,
      hostUserId: session.userId,
      hostName: session.name,
      emails,
    });
    for (const r of emailDispatch.results) {
      created.push({
        id: r.inviteId,
        email: r.email,
        invitedUserId: r.invitedUserId ?? null,
      });
    }
  }

  const emailsSent =
    (emailDispatch?.sentCount ?? 0) + networkEmailResults.filter((r) => r.sent).length;
  const emailsFailed =
    (emailDispatch?.failedCount ?? 0) +
    networkEmailResults.filter((r) => !r.sent && r.email).length;
  const inviteErrors = [
    ...(emailDispatch?.results ?? [])
      .filter((r) => !r.sent)
      .map((r) => `${r.email}: ${r.error || "send failed"}`),
    ...networkEmailResults
      .filter((r) => !r.sent)
      .map((r) => `${r.email || r.userId}: ${r.error || "send failed"}`),
  ];

  return NextResponse.json({
    ok: emailsFailed === 0 && (emailsSent > 0 || created.length > 0),
    invites: created,
    guestUrl: inviteEmail.guestUrl,
    googleCalUrl: inviteEmail.googleCalUrl,
    outlookCalUrl: inviteEmail.outlookCalUrl,
    invitesSent: emailsSent,
    invitesFailed: emailsFailed,
    inviteErrors,
    emailTransportConfigured: isEmailTransportConfigured(),
  });
}
