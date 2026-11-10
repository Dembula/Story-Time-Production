import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";
import { leaveMeetAsUser } from "@/lib/meet/join";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meeting = await resolveMeetByIdOrCode(id);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const open = await prisma.meetParticipant.findFirst({
    where: { meetingId: meeting.id, userId: session.userId, leftAt: null },
    select: { peerId: true },
  });

  await leaveMeetAsUser(meeting.id, session.userId);

  if (open?.peerId) {
    await prisma.meetSignal.create({
      data: {
        meetingId: meeting.id,
        fromPeer: open.peerId,
        toPeer: "*",
        type: "peer-leave",
        payload: { peerId: open.peerId },
      },
    });
  }

  return NextResponse.json({ ok: true });
}
