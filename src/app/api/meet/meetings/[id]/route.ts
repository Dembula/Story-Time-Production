import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";

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
  } | null;

  const updated = await prisma.meetMeeting.update({
    where: { id: meeting.id },
    data: {
      ...(body?.title != null ? { title: String(body.title).trim() || meeting.title } : {}),
      ...(body?.status === "ENDED"
        ? { status: "ENDED", endedAt: new Date() }
        : body?.status
          ? { status: body.status }
          : {}),
      ...(body?.passcode !== undefined ? { passcode: body.passcode?.trim() || null } : {}),
      ...(typeof body?.waitingRoom === "boolean" ? { waitingRoom: body.waitingRoom } : {}),
    },
  });

  return NextResponse.json({ meeting: updated });
}
