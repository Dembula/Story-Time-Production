import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMeetRtcIdentity, isMeetHostOrCoHost } from "@/lib/meet/access";
import { getMeetIceServers } from "@/lib/meet/ice-servers";
import { getMeetCapacityState } from "@/lib/meet/capacity";
import {
  MEET_END_GRACE_MS,
  shouldAutoEndMeet,
} from "@/lib/meet/schedule-window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Long-poll style: return peers + signals after `after` id. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId: rawId } = await ctx.params;
  let meeting = await prisma.meetMeeting.findFirst({
    where: { OR: [{ id: rawId }, { code: rawId }, { code: rawId.toUpperCase() }] },
    select: { id: true, status: true, scheduledEndAt: true },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const meetingId = meeting.id;

  // Past planned end + 15m grace → auto-end even if host never confirms.
  if (
    meeting.status === "LIVE" &&
    meeting.scheduledEndAt &&
    shouldAutoEndMeet(meeting.scheduledEndAt)
  ) {
    meeting = await prisma.meetMeeting.update({
      where: { id: meetingId },
      data: { status: "ENDED", endedAt: new Date() },
      select: { id: true, status: true, scheduledEndAt: true },
    });
    await prisma.meetParticipant.updateMany({
      where: { meetingId, leftAt: null },
      data: { leftAt: new Date() },
    });
    await prisma.meetGuest.updateMany({
      where: { meetingId, leftAt: null },
      data: { leftAt: new Date(), status: "LEFT" },
    });
  }

  if (meeting.status === "ENDED" || meeting.status === "CANCELLED") {
    return NextResponse.json({
      status: "ENDED",
      peers: [],
      signals: [],
      waiting: [],
      iceServers: getMeetIceServers(),
      schedule: meeting.scheduledEndAt
        ? {
            scheduledEndAt: meeting.scheduledEndAt.toISOString(),
            pastEnd: true,
            autoEnded: true,
            graceEndsAt: new Date(
              meeting.scheduledEndAt.getTime() + MEET_END_GRACE_MS,
            ).toISOString(),
            msUntilAutoEnd: 0,
          }
        : null,
    });
  }

  const identity = await resolveMeetRtcIdentity(meetingId);
  if (!identity) {
    // Soft end: left the call or session expired — clients should exit cleanly.
    return NextResponse.json({
      status: "LEFT",
      peers: [],
      signals: [],
      waiting: [],
      iceServers: getMeetIceServers(),
    });
  }

  // Waiting guests only receive admission status — no media peers yet.
  if (identity.kind === "guest" && identity.status === "WAITING") {
    const guest = await prisma.meetGuest.findUnique({
      where: { id: identity.guestId },
      select: { status: true },
    });
    return NextResponse.json({
      status: guest?.status ?? "WAITING",
      peerId: identity.peerId,
      peers: [],
      signals: [],
      waiting: [],
      iceServers: getMeetIceServers(),
    });
  }

  const url = new URL(req.url);
  const after = Number(url.searchParams.get("after") ?? "0") || 0;

  await prisma.meetParticipant.updateMany({
    where:
      identity.kind === "user"
        ? { id: identity.participantId }
        : { meetingId, peerId: identity.peerId, leftAt: null },
    data: { lastSeenAt: new Date() },
  });
  if (identity.kind === "guest") {
    await prisma.meetGuest.update({
      where: { id: identity.guestId },
      data: { lastSeenAt: new Date() },
    });
  }

  const [participants, guests, signals] = await Promise.all([
    prisma.meetParticipant.findMany({
      where: { meetingId, leftAt: null, peerId: { not: null } },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
    prisma.meetGuest.findMany({
      where: { meetingId, status: "ADMITTED", leftAt: null, peerId: { not: null } },
      select: { id: true, name: true, peerId: true, status: true },
    }),
    prisma.meetSignal.findMany({
      where: {
        meetingId,
        id: { gt: after },
        OR: [{ toPeer: identity.peerId }, { toPeer: "*" }],
        NOT: { fromPeer: identity.peerId },
      },
      orderBy: { id: "asc" },
      take: 200,
    }),
  ]);

  const peers = [
    ...participants
      .filter((p) => p.peerId && p.peerId !== identity.peerId)
      .map((p) => ({
        peerId: p.peerId!,
        participantId: p.id,
        guestId: null as string | null,
        name: p.user.name || p.user.email || "Participant",
        isGuest: false,
        role: p.role,
        isMuted: p.isMuted,
        isVideoOff: p.isVideoOff,
      })),
    ...guests
      .filter((g) => g.peerId && g.peerId !== identity.peerId)
      .map((g) => ({
        peerId: g.peerId!,
        participantId: null as string | null,
        guestId: g.id,
        name: g.name,
        isGuest: true,
        role: "GUEST",
        isMuted: false,
        isVideoOff: false,
      })),
  ];

  let waiting: { id: string; name: string }[] = [];
  if (identity.kind === "user") {
    const manager = await isMeetHostOrCoHost(meetingId, identity.userId);
    if (manager) {
      waiting = await prisma.meetGuest.findMany({
        where: { meetingId, status: "WAITING", leftAt: null },
        select: { id: true, name: true },
        orderBy: { joinedAt: "asc" },
      });
    }
  }

  const capacity = await getMeetCapacityState(meetingId);
  const now = Date.now();
  const endAt = meeting.scheduledEndAt;
  const graceEndsAt = endAt ? new Date(endAt.getTime() + MEET_END_GRACE_MS) : null;
  const schedule = endAt
    ? {
        scheduledEndAt: endAt.toISOString(),
        pastEnd: now >= endAt.getTime(),
        autoEnded: false,
        graceEndsAt: graceEndsAt!.toISOString(),
        msUntilAutoEnd: Math.max(0, graceEndsAt!.getTime() - now),
      }
    : null;

  return NextResponse.json({
    status: "admitted",
    peerId: identity.peerId,
    peers,
    signals: signals.map((s) => ({
      id: s.id,
      fromPeer: s.fromPeer,
      toPeer: s.toPeer,
      type: s.type,
      payload: s.payload,
      createdAt: s.createdAt,
    })),
    waiting,
    capacity,
    iceServers: getMeetIceServers(),
    isManager: identity.kind === "user" ? await isMeetHostOrCoHost(meetingId, identity.userId) : false,
    schedule,
  });
}
