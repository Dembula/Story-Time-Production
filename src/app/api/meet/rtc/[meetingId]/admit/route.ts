import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isMeetHostOrCoHost,
  requireCreatorSession,
  resolveMeetByIdOrCode,
} from "@/lib/meet/access";
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
  try {
    const { meetingId: rawId } = await ctx.params;
    const session = await requireCreatorSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const meeting = await resolveMeetByIdOrCode(rawId);
    if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    if (!(await isMeetHostOrCoHost(meeting.id, session.userId))) {
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
      where: { id: guestId, meetingId: meeting.id },
    });
    if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });

    if (action === "deny") {
      const updated = await prisma.meetGuest.update({
        where: { id: guest.id },
        data: { status: "DENIED", leftAt: new Date() },
      });
      return NextResponse.json({
        ok: true,
        guest: updated,
        capacity: await getMeetCapacityState(meeting.id),
      });
    }

    if (guest.status !== "ADMITTED") {
      await assertMeetHasCapacity(meeting.id);
    }

    const updated = await prisma.meetGuest.update({
      where: { id: guest.id },
      data: {
        status: "ADMITTED",
        admittedAt: guest.admittedAt ?? new Date(),
        leftAt: null,
      },
    });

    if (guest.peerId) {
      await prisma.meetSignal.create({
        data: {
          meetingId: meeting.id,
          fromPeer: "host",
          toPeer: "*",
          type: "peer-join",
          payload: { peerId: guest.peerId, name: guest.name, isGuest: true },
        },
      });
    }

    return NextResponse.json({
      ok: true,
      guest: updated,
      capacity: await getMeetCapacityState(meeting.id),
    });
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
    console.error("[meet/admit]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Admit failed" },
      { status: 500 },
    );
  }
}
