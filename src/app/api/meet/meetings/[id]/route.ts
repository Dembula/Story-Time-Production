import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";
import { buildMeetScheduleChangeEmail } from "@/lib/meet/schedule-change-email";
import { sendMeetInviteMail } from "@/lib/meet/invite-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meeting = await resolveMeetByIdOrCode(id);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const full = await prisma.meetMeeting.findUnique({
    where: { id: meeting.id },
    include: {
      host: { select: { id: true, name: true, email: true, image: true } },
      participants: {
        where: { leftAt: null },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      guests: {
        where: { leftAt: null, status: { in: ["WAITING", "ADMITTED"] } },
        select: {
          id: true,
          name: true,
          status: true,
          peerId: true,
          joinedAt: true,
        },
      },
      summary: true,
    },
  });

  return NextResponse.json({ meeting: full, guestUrl: `/meet/${meeting.code}` });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meeting = await resolveMeetByIdOrCode(id);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (meeting.hostUserId !== session.userId) {
    return NextResponse.json({ error: "Only the host can update this meeting" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    status?: string;
    passcode?: string | null;
    waitingRoom?: boolean;
    scheduledAt?: string | null;
    /** When true, email existing invitees about cancel/reschedule. Default true for schedule changes. */
    notifyInvitees?: boolean;
  } | null;

  const previousScheduledAt = meeting.scheduledAt;
  const wantsCancel =
    body?.status === "CANCELLED" || body?.status === "CANCELED" || body?.status === "cancel";
  const nextScheduledAt =
    body?.scheduledAt === null
      ? null
      : body?.scheduledAt
        ? new Date(body.scheduledAt)
        : undefined;

  if (nextScheduledAt !== undefined && nextScheduledAt !== null) {
    if (Number.isNaN(nextScheduledAt.getTime())) {
      return NextResponse.json({ error: "Invalid scheduled date" }, { status: 400 });
    }
  }

  if (wantsCancel && meeting.status === "LIVE") {
    return NextResponse.json(
      { error: "End a live Meet from the call controls instead of cancelling." },
      { status: 400 },
    );
  }

  if (
    nextScheduledAt !== undefined &&
    meeting.status !== "SCHEDULED" &&
    !wantsCancel
  ) {
    return NextResponse.json(
      { error: "Only scheduled Meets can be rescheduled." },
      { status: 400 },
    );
  }

  const updated = await prisma.meetMeeting.update({
    where: { id: meeting.id },
    data: {
      ...(body?.title != null ? { title: String(body.title).trim() || meeting.title } : {}),
      ...(wantsCancel
        ? { status: "CANCELLED", endedAt: new Date() }
        : body?.status === "ENDED"
          ? { status: "ENDED", endedAt: new Date() }
          : body?.status && ["SCHEDULED", "LIVE"].includes(body.status)
            ? { status: body.status }
            : {}),
      ...(body?.passcode !== undefined ? { passcode: body.passcode?.trim() || null } : {}),
      ...(typeof body?.waitingRoom === "boolean" ? { waitingRoom: body.waitingRoom } : {}),
      ...(nextScheduledAt !== undefined ? { scheduledAt: nextScheduledAt } : {}),
    },
  });

  const scheduleChanged =
    nextScheduledAt !== undefined &&
    (previousScheduledAt?.getTime() ?? null) !== (updated.scheduledAt?.getTime() ?? null);
  const shouldNotify =
    body?.notifyInvitees !== false && (wantsCancel || scheduleChanged);

  let notified = 0;
  let notifyFailed = 0;
  if (shouldNotify) {
    const invites = await prisma.meetInvite.findMany({
      where: {
        meetingId: meeting.id,
        OR: [{ email: { not: null } }, { invitedUser: { email: { not: null } } }],
      },
      include: { invitedUser: { select: { email: true } } },
      take: 80,
    });
    const recipients = [
      ...new Set(
        invites
          .map((i) => (i.email || i.invitedUser?.email || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    ];

    const mail = buildMeetScheduleChangeEmail({
      hostName: session.name,
      title: updated.title,
      code: updated.code,
      passcode: updated.passcode,
      kind: wantsCancel ? "cancelled" : "rescheduled",
      previousScheduledAt,
      scheduledAt: updated.scheduledAt,
    });

    for (const to of recipients) {
      const result = await sendMeetInviteMail({
        to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      if (result.ok) notified += 1;
      else notifyFailed += 1;
    }
  }

  return NextResponse.json({
    meeting: updated,
    notified,
    notifyFailed,
  });
}
