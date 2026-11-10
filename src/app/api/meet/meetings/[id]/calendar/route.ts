import { NextResponse } from "next/server";
import { requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";
import { buildMeetIcs, resolveMeetWindow } from "@/lib/meet/ics";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download an .ics calendar file for a Meet (host or participant). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meeting = await resolveMeetByIdOrCode(id);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed =
    meeting.hostUserId === session.userId ||
    Boolean(
      await prisma.meetParticipant.findFirst({
        where: { meetingId: meeting.id, userId: session.userId },
        select: { id: true },
      }),
    ) ||
    Boolean(
      await prisma.meetInvite.findFirst({
        where: { meetingId: meeting.id, invitedUserId: session.userId },
        select: { id: true },
      }),
    );

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const host = await prisma.user.findUnique({
    where: { id: meeting.hostUserId },
    select: { name: true },
  });
  const { startAt, endAt } = resolveMeetWindow({
    scheduledAt: meeting.scheduledAt,
    startedAt: meeting.startedAt,
  });
  const ics = buildMeetIcs({
    meetingId: meeting.id,
    title: meeting.title,
    code: meeting.code,
    passcode: meeting.passcode,
    hostName: host?.name ?? null,
    startAt,
    endAt,
  });

  return new NextResponse(ics.body, {
    status: 200,
    headers: {
      "Content-Type": ics.contentType,
      "Content-Disposition": `attachment; filename="${ics.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
