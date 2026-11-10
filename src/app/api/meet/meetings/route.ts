import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession } from "@/lib/meet/access";
import { absoluteMeetGuestUrl, generateMeetCode } from "@/lib/meet/codes";
import { joinMeetAsUser } from "@/lib/meet/join";
import { createCreatorCalendarEvent } from "@/lib/creator-command-center-calendar";

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

  return NextResponse.json({
    meeting,
    participant,
    guestUrl: `/meet/${meeting.code}`,
    calendarEventId,
  });
}
