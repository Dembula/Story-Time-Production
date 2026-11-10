import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession, isMeetHostOrCoHost } from "@/lib/meet/access";
import {
  MeetFullError,
  assertMeetHasCapacity,
  getMeetCapacityState,
} from "@/lib/meet/capacity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId } = await ctx.params;
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isMeetHostOrCoHost(meetingId, session.userId))) {
    return NextResponse.json({ error: "Only host/co-host can admit guests" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    guestId?: string;
    action?: "admit" | "deny";
  } | null;

  const guestId = String(body?.guestId ?? "").trim();
  const action = body?.action === "deny" ? "deny" : "admit";
  if (!guestId) return NextResponse.json({ error: "guestId required" }, { status: 400 });

  const guest = await prisma.meetGuest.findFirst({
    where: { id: guestId, meetingId },
  });
  if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

  try {
    const updated =
      action === "deny"
        ? await prisma.meetGuest.update({
            where: { id: guest.id },
            data: { status: "DENIED", leftAt: new Date() },
          })
        : await prisma.$transaction(async (tx) => {
            if (guest.status !== "ADMITTED") {
              await assertMeetHasCapacity(meetingId);
            }
            return tx.meetGuest.update({
              where: { id: guest.id },
              data: { status: "ADMITTED", admittedAt: new Date() },
            });
          });

    if (action === "admit" && guest.peerId) {
      await prisma.meetSignal.create({
        data: {
          meetingId,
          fromPeer: "host",
          toPeer: "*",
          type: "peer-join",
          payload: { peerId: guest.peerId, name: guest.name, isGuest: true },
        },
      });
    }

    const capacity = await getMeetCapacityState(meetingId);
    return NextResponse.json({ ok: true, guest: updated, capacity });
  } catch (err) {
    if (err instanceof MeetFullError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          occupied: err.occupied,
          capacity: err.capacity,
        },
        { status: 409 },
      );
    }
    throw err;
  }
}
