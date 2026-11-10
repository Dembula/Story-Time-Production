import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";
import { getActiveMeetGuest } from "@/lib/meet/guest-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const meeting = await resolveMeetByIdOrCode(id);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await requireCreatorSession();
  const guest = session ? null : await getActiveMeetGuest(meeting.id);
  if (!session && !guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [participants, waiting] = await Promise.all([
    prisma.meetParticipant.findMany({
      where: { meetingId: meeting.id, leftAt: null },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.meetGuest.findMany({
      where: { meetingId: meeting.id, status: "WAITING", leftAt: null },
      select: { id: true, name: true, status: true, joinedAt: true, peerId: true },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  const admittedGuests = await prisma.meetGuest.findMany({
    where: { meetingId: meeting.id, status: "ADMITTED", leftAt: null },
    select: { id: true, name: true, status: true, peerId: true, joinedAt: true },
  });

  return NextResponse.json({ participants, waiting, admittedGuests });
}
