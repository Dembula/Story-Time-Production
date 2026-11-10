import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMeetHostOrCoHost, requireCreatorSession, resolveMeetByIdOrCode } from "@/lib/meet/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Host / co-host controls: mute, remove, lock, end-for-all, promote. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meeting = await resolveMeetByIdOrCode(id);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isMeetHostOrCoHost(meeting.id, session.userId))) {
    return NextResponse.json({ error: "Host permissions required" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    action?:
      | "mute_participant"
      | "remove_participant"
      | "remove_guest"
      | "lock"
      | "unlock"
      | "end_for_all"
      | "promote_cohost"
      | "demote_participant";
    participantId?: string;
    guestId?: string;
    userId?: string;
  } | null;

  const action = body?.action;
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

  switch (action) {
    case "mute_participant": {
      const participantId = String(body?.participantId ?? "").trim();
      if (!participantId) return NextResponse.json({ error: "participantId required" }, { status: 400 });
      const row = await prisma.meetParticipant.updateMany({
        where: { id: participantId, meetingId: meeting.id, leftAt: null },
        data: { isMuted: true },
      });
      if (!row.count) return NextResponse.json({ error: "Participant not found" }, { status: 404 });
      const p = await prisma.meetParticipant.findUnique({ where: { id: participantId } });
      if (p?.peerId) {
        await prisma.meetSignal.create({
          data: {
            meetingId: meeting.id,
            fromPeer: "host",
            toPeer: p.peerId,
            type: "media-state",
            payload: { isMuted: true, forcedByHost: true },
          },
        });
      }
      return NextResponse.json({ ok: true });
    }
    case "remove_participant": {
      const participantId = String(body?.participantId ?? "").trim();
      if (!participantId) return NextResponse.json({ error: "participantId required" }, { status: 400 });
      const p = await prisma.meetParticipant.findFirst({
        where: { id: participantId, meetingId: meeting.id, leftAt: null },
      });
      if (!p) return NextResponse.json({ error: "Participant not found" }, { status: 404 });
      if (p.userId === meeting.hostUserId) {
        return NextResponse.json({ error: "Cannot remove the meeting host" }, { status: 400 });
      }
      await prisma.meetParticipant.update({
        where: { id: p.id },
        data: { leftAt: new Date() },
      });
      if (p.peerId) {
        await prisma.meetSignal.create({
          data: {
            meetingId: meeting.id,
            fromPeer: "host",
            toPeer: "*",
            type: "peer-leave",
            payload: { peerId: p.peerId, removedByHost: true },
          },
        });
      }
      return NextResponse.json({ ok: true });
    }
    case "remove_guest": {
      const guestId = String(body?.guestId ?? "").trim();
      if (!guestId) return NextResponse.json({ error: "guestId required" }, { status: 400 });
      const g = await prisma.meetGuest.findFirst({
        where: { id: guestId, meetingId: meeting.id },
      });
      if (!g) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
      await prisma.meetGuest.update({
        where: { id: g.id },
        data: { status: "DENIED", leftAt: new Date() },
      });
      if (g.peerId) {
        await prisma.meetSignal.create({
          data: {
            meetingId: meeting.id,
            fromPeer: "host",
            toPeer: "*",
            type: "peer-leave",
            payload: { peerId: g.peerId, removedByHost: true },
          },
        });
      }
      return NextResponse.json({ ok: true });
    }
    case "lock":
    case "unlock": {
      await prisma.meetMeeting.update({
        where: { id: meeting.id },
        data: { waitingRoom: action === "lock" },
      });
      return NextResponse.json({ ok: true, waitingRoom: action === "lock" });
    }
    case "end_for_all": {
      await prisma.meetMeeting.update({
        where: { id: meeting.id },
        data: { status: "ENDED", endedAt: new Date() },
      });
      await prisma.meetParticipant.updateMany({
        where: { meetingId: meeting.id, leftAt: null },
        data: { leftAt: new Date() },
      });
      await prisma.meetGuest.updateMany({
        where: { meetingId: meeting.id, leftAt: null },
        data: { leftAt: new Date(), status: "LEFT" },
      });
      await prisma.meetSignal.create({
        data: {
          meetingId: meeting.id,
          fromPeer: "host",
          toPeer: "*",
          type: "peer-leave",
          payload: { endForAll: true },
        },
      });
      return NextResponse.json({ ok: true });
    }
    case "promote_cohost":
    case "demote_participant": {
      const participantId = String(body?.participantId ?? "").trim();
      if (!participantId) return NextResponse.json({ error: "participantId required" }, { status: 400 });
      if (meeting.hostUserId !== session.userId) {
        return NextResponse.json({ error: "Only the host can change co-host roles" }, { status: 403 });
      }
      await prisma.meetParticipant.updateMany({
        where: { id: participantId, meetingId: meeting.id, leftAt: null },
        data: { role: action === "promote_cohost" ? "CO_HOST" : "PARTICIPANT" },
      });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
