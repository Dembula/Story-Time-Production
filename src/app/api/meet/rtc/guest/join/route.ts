import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMeetByIdOrCode } from "@/lib/meet/access";
import {
  generateMeetGuestSessionToken,
  generateMeetPeerId,
} from "@/lib/meet/codes";
import { MEET_GUEST_COOKIE, meetGuestCookieOptions } from "@/lib/meet/guest-access";
import {
  MeetFullError,
  assertMeetHasCapacity,
  getMeetCapacityState,
} from "@/lib/meet/capacity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public guest join — waiting room unless host disabled it. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    code?: string;
    name?: string;
    passcode?: string;
  } | null;

  const code = String(body?.code ?? "").trim();
  const name = String(body?.name ?? "").trim().slice(0, 80);
  if (!code || !name) {
    return NextResponse.json({ error: "Name and meeting code are required" }, { status: 400 });
  }

  const meeting = await resolveMeetByIdOrCode(code);
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  if (meeting.status === "ENDED") {
    return NextResponse.json({ error: "This meeting has ended" }, { status: 410 });
  }
  if (meeting.passcode && String(body?.passcode ?? "").trim() !== meeting.passcode) {
    return NextResponse.json(
      { error: "Passcode required", code: "PASSCODE_REQUIRED" },
      { status: 403 },
    );
  }

  const sessionToken = generateMeetGuestSessionToken();
  const peerId = generateMeetPeerId("g");
  const autoAdmit = !meeting.waitingRoom;

  // Auto-admit takes a seat immediately; waiting-room guests only seat on admit.
  let capacity = await getMeetCapacityState(meeting.id);
  if (autoAdmit) {
    try {
      capacity = await assertMeetHasCapacity(meeting.id);
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
  } else if (capacity.isFull) {
    return NextResponse.json(
      {
        error: `This Meet is full (${capacity.occupied}/${capacity.capacity}). The host can admit you once a seat frees up — try again shortly.`,
        code: "MEETING_FULL",
        occupied: capacity.occupied,
        capacity: capacity.capacity,
      },
      { status: 409 },
    );
  }

  const guest = await prisma.meetGuest.create({
    data: {
      meetingId: meeting.id,
      name,
      sessionToken,
      peerId,
      status: autoAdmit ? "ADMITTED" : "WAITING",
      admittedAt: autoAdmit ? new Date() : null,
    },
  });

  if (meeting.status === "SCHEDULED") {
    await prisma.meetMeeting.update({
      where: { id: meeting.id },
      data: { status: "LIVE", startedAt: meeting.startedAt ?? new Date() },
    });
  }

  capacity = await getMeetCapacityState(meeting.id);

  const res = NextResponse.json({
    ok: true,
    guest: {
      id: guest.id,
      name: guest.name,
      status: guest.status,
      peerId: guest.peerId,
    },
    meeting: {
      id: meeting.id,
      code: meeting.code,
      title: meeting.title,
      status: meeting.status === "SCHEDULED" ? "LIVE" : meeting.status,
    },
    waiting: guest.status === "WAITING",
    capacity,
  });
  res.cookies.set(MEET_GUEST_COOKIE, sessionToken, meetGuestCookieOptions());
  return res;
}
