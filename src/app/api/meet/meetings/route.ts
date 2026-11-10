import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession } from "@/lib/meet/access";
import { absoluteMeetGuestUrl, generateMeetCode, generateMeetInviteToken } from "@/lib/meet/codes";
import { joinMeetAsUser } from "@/lib/meet/join";
import { createCreatorCalendarEvent } from "@/lib/creator-command-center-calendar";
import { buildMeetInviteEmail } from "@/lib/meet/invite-email";
import { sendTransactionalEmail } from "@/lib/email";
import { notifyUser } from "@/lib/notify-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List meetings for the current creator (hosted or invited/joined). */
export async function GET() {
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meetings = await prisma.meetMeeting.findMany({
    where: {
      OR: [
        { hostUserId: session.userId },
        { participants: { some: { userId: session.userId } } },
        { invites: { some: { invitedUserId: session.userId, status: "PENDING" } } },
      ],
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 50,
    include: {
      host: { select: { id: true, name: true, email: true, image: true } },
      _count: { select: { participants: true, guests: true } },
      summary: { select: { id: true, createdAt: true } },
    },
  });

  return NextResponse.json({ meetings });
}

/** Create an instant or scheduled meeting and optionally join as host. */
export async function POST(req: Request) {
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    passcode?: string | null;
    waitingRoom?: boolean;
    scheduledAt?: string | null;
    joinNow?: boolean;
    /** Optional invite emails sent when scheduling (or creating) a Meet. */
    inviteEmails?: string[];
  } | null;

  const title = String(body?.title ?? "").trim() || "Story Time Meet";
  let code = generateMeetCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.meetMeeting.findUnique({ where: { code } });
    if (!clash) break;
    code = generateMeetCode();
  }

  const scheduledAt = body?.scheduledAt ? new Date(body.scheduledAt) : null;
  const joinNow = body?.joinNow !== false && !scheduledAt;

  const meeting = await prisma.meetMeeting.create({
    data: {
      code,
      title,
      hostUserId: session.userId,
      status: joinNow ? "LIVE" : "SCHEDULED",
      passcode: body?.passcode?.trim() || null,
      waitingRoom: body?.waitingRoom !== false,
      scheduledAt,
      startedAt: joinNow ? new Date() : null,
    },
  });

  let participant = null;
  if (joinNow) {
    const joined = await joinMeetAsUser({
      meetingId: meeting.id,
      userId: session.userId,
      asHost: true,
    });
    participant = joined.participant;
  }

  const guestUrl = absoluteMeetGuestUrl(meeting.code);
  const startAt = scheduledAt ?? meeting.startedAt ?? new Date();
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  let calendarEventId: string | null = null;
  try {
    const cal = await createCreatorCalendarEvent(session.userId, {
      title: `Meet: ${meeting.title}`,
      description: [
        "Story Time Meet",
        `Code: ${meeting.code}`,
        meeting.passcode ? `Passcode: ${meeting.passcode}` : null,
        `Join: ${guestUrl}`,
        `Creator room: /creator/meet/room/${meeting.id}`,
      ]
        .filter(Boolean)
        .join("\n"),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      allDay: false,
      visibility: "PERSONAL",
    });
    calendarEventId = cal.id;
  } catch (err) {
    console.warn("[meet] calendar event create failed", err);
  }

  const inviteEmails = Array.isArray(body?.inviteEmails)
    ? [
        ...new Set(
          body!.inviteEmails
            .map((e) => String(e).trim().toLowerCase())
            .filter((e) => e.includes("@")),
        ),
      ].slice(0, 40)
    : [];

  let invitesSent = 0;
  if (inviteEmails.length) {
    const inviteEmail = buildMeetInviteEmail({
      hostName: session.name,
      title: meeting.title,
      code: meeting.code,
      meetingId: meeting.id,
      passcode: meeting.passcode,
      scheduledAt: meeting.scheduledAt ?? meeting.startedAt ?? new Date(),
    });
    const icsAttachment = {
      filename: inviteEmail.ics.filename,
      contentType: inviteEmail.ics.contentType,
      content: inviteEmail.ics.body,
    };

    for (const email of inviteEmails) {
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
      });
      await prisma.meetInvite.create({
        data: {
          meetingId: meeting.id,
          invitedByUserId: session.userId,
          invitedUserId: existingUser?.id ?? null,
          email,
          token: generateMeetInviteToken(),
        },
      });
      const sent = await sendTransactionalEmail({
        to: email,
        subject: inviteEmail.subject,
        text: inviteEmail.text,
        html: inviteEmail.html,
        attachments: [icsAttachment],
      });
      if (sent) invitesSent += 1;

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
            googleCalUrl: inviteEmail.googleCalUrl,
            outlookCalUrl: inviteEmail.outlookCalUrl,
          },
        });
      }
    }
  }

  return NextResponse.json({
    meeting,
    participant,
    guestUrl: `/meet/${meeting.code}`,
    absoluteGuestUrl: guestUrl,
    calendarEventId,
    calendarDownloadPath: `/api/meet/meetings/${meeting.id}/calendar`,
    invitesSent,
  });
}
