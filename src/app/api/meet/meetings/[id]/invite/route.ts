import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";
import { generateMeetInviteToken } from "@/lib/meet/codes";
import { buildMeetInviteEmail } from "@/lib/meet/invite-email";
import { sendTransactionalEmail } from "@/lib/email";
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

  const userIds = Array.isArray(body?.userIds) ? body!.userIds.map(String).filter(Boolean) : [];
  const emails = Array.isArray(body?.emails)
    ? body!.emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
    : [];

  if (!userIds.length && !emails.length) {
    return NextResponse.json({ error: "Provide userIds and/or emails" }, { status: 400 });
  }

  const inviteEmail = buildMeetInviteEmail({
    hostName: session.name,
    title: meeting.title,
    code: meeting.code,
    passcode: meeting.passcode,
    scheduledAt: meeting.scheduledAt,
  });
  const created: { id: string; email?: string | null; invitedUserId?: string | null }[] = [];

  for (const userId of userIds) {
    if (userId === session.userId) continue;
    const token = generateMeetInviteToken();
    const invite = await prisma.meetInvite.create({
      data: {
        meetingId: meeting.id,
        invitedByUserId: session.userId,
        invitedUserId: userId,
        token,
      },
    });
    created.push({ id: invite.id, invitedUserId: userId });
    await notifyUser({
      userId,
      type: "meet_invite",
      title: "Story Time Meet invite",
      body: `${session.name} invited you to “${meeting.title}”. Code ${meeting.code}.`,
      metadata: {
        meetingId: meeting.id,
        code: meeting.code,
        href: `/creator/meet/room/${meeting.id}`,
        guestUrl: inviteEmail.guestUrl,
      },
      email: {
        subject: inviteEmail.subject,
        text: inviteEmail.text,
        html: inviteEmail.html,
      },
    });
  }

  for (const email of emails) {
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    const token = generateMeetInviteToken();
    const invite = await prisma.meetInvite.create({
      data: {
        meetingId: meeting.id,
        invitedByUserId: session.userId,
        invitedUserId: existingUser?.id ?? null,
        email,
        token,
      },
    });
    created.push({ id: invite.id, email, invitedUserId: existingUser?.id ?? null });

    await sendTransactionalEmail({
      to: email,
      subject: inviteEmail.subject,
      text: inviteEmail.text,
      html: inviteEmail.html,
    });

    if (existingUser?.id) {
      await notifyUser({
        userId: existingUser.id,
        type: "meet_invite",
        title: "Story Time Meet invite",
        body: `${session.name} invited you to “${meeting.title}”. Code ${meeting.code}.`,
        metadata: {
          meetingId: meeting.id,
          code: meeting.code,
          href: `/creator/meet/room/${meeting.id}`,
          guestUrl: inviteEmail.guestUrl,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, invites: created, guestUrl: inviteEmail.guestUrl });
}
