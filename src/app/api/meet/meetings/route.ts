import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession } from "@/lib/meet/access";
import { absoluteMeetGuestUrl, generateMeetCode } from "@/lib/meet/codes";
import { joinMeetAsUser } from "@/lib/meet/join";
import { createCreatorCalendarEvent } from "@/lib/creator-command-center-calendar";
import { dispatchMeetEmailInvites, parseInviteEmailList } from "@/lib/meet/invite-dispatch";
import { isEmailTransportConfigured } from "@/lib/email";

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
    scheduledEndAt?: string | null;
    joinNow?: boolean;
    /** Optional invite emails sent when scheduling (or creating) a Meet. */
    inviteEmails?: string[];
  } | null;

  const title = String(body?.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Please enter a meeting title" }, { status: 400 });
  }
  let code = generateMeetCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.meetMeeting.findUnique({ where: { code } });
    if (!clash) break;
    code = generateMeetCode();
  }

  const scheduledAt = body?.scheduledAt ? new Date(body.scheduledAt) : null;
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }
  let scheduledEndAt = body?.scheduledEndAt ? new Date(body.scheduledEndAt) : null;
  if (scheduledEndAt && Number.isNaN(scheduledEndAt.getTime())) {
    return NextResponse.json({ error: "Invalid end time" }, { status: 400 });
  }
  if (!scheduledEndAt && scheduledAt) {
    scheduledEndAt = new Date(scheduledAt.getTime() + 60 * 60 * 1000);
  }
  if (scheduledEndAt && scheduledAt && scheduledEndAt.getTime() <= scheduledAt.getTime()) {
    return NextResponse.json({ error: "End time must be after the start time" }, { status: 400 });
  }
  if (scheduledEndAt && !scheduledAt && body?.joinNow !== false) {
    // Instant Meet with a planned finish — end must be in the future.
    if (scheduledEndAt.getTime() <= Date.now() + 60_000) {
      return NextResponse.json({ error: "End time must be at least a minute from now" }, { status: 400 });
    }
  }

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
      scheduledEndAt,
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

  const guestUrl = absoluteMeetGuestUrl(meeting.code, undefined, {
    passcode: meeting.passcode,
  });
  const startAt = scheduledAt ?? meeting.startedAt ?? new Date();
  const endAt =
    scheduledEndAt && scheduledEndAt.getTime() > startAt.getTime()
      ? scheduledEndAt
      : new Date(startAt.getTime() + 60 * 60 * 1000);
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

  const inviteEmails = parseInviteEmailList(body?.inviteEmails);
  let invitesSent = 0;
  let invitesFailed = 0;
  let inviteErrors: string[] = [];
  let inviteResults: Array<{ email: string; sent: boolean; error?: string }> = [];

  if (inviteEmails.length) {
    const dispatched = await dispatchMeetEmailInvites({
      meeting,
      hostUserId: session.userId,
      hostName: session.name,
      emails: inviteEmails,
    });
    invitesSent = dispatched.sentCount;
    invitesFailed = dispatched.failedCount;
    inviteResults = dispatched.results.map((r) => ({
      email: r.email,
      sent: r.sent,
      error: r.error,
    }));
    inviteErrors = dispatched.results
      .filter((r) => !r.sent)
      .map((r) => `${r.email}: ${r.error || "send failed"}`);
  }

  return NextResponse.json({
    meeting,
    participant,
    guestUrl: `/meet/${meeting.code}${
      meeting.passcode ? `?passcode=${encodeURIComponent(meeting.passcode)}` : ""
    }`,
    absoluteGuestUrl: guestUrl,
    calendarEventId,
    calendarDownloadPath: `/api/meet/meetings/${meeting.id}/calendar`,
    invitesSent,
    invitesFailed,
    inviteErrors,
    inviteResults,
    emailTransportConfigured: isEmailTransportConfigured(),
  });
}
