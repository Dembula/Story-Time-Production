import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveMeetRtcIdentity } from "@/lib/meet/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ meetingId: string }> },
) {
  const { meetingId: rawId } = await ctx.params;
  const meeting = await prisma.meetMeeting.findFirst({
    where: { OR: [{ id: rawId }, { code: rawId }, { code: rawId.toUpperCase() }] },
    select: { id: true },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const meetingId = meeting.id;

  const identity = await resolveMeetRtcIdentity(meetingId);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (identity.kind === "guest" && identity.status === "WAITING") {
    return NextResponse.json({ error: "Waiting for host admission" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    toPeer?: string;
    type?: string;
    payload?: unknown;
  } | null;

  const type = String(body?.type ?? "").trim();
  const toPeer = String(body?.toPeer ?? "*").trim() || "*";
  if (!type) return NextResponse.json({ error: "type required" }, { status: 400 });

  const allowed = new Set([
    "offer",
    "answer",
    "candidate",
    "speech",
    "reaction",
    "peer-join",
    "peer-leave",
    "media-state",
    "pin",
    "screen-share",
  ]);
  if (!allowed.has(type)) {
    return NextResponse.json({ error: "Invalid signal type" }, { status: 400 });
  }

  const signal = await prisma.meetSignal.create({
    data: {
      meetingId,
      fromPeer: identity.peerId,
      toPeer,
      type,
      payload: (body?.payload ?? {}) as object,
    },
  });

  if (type === "media-state" && identity.kind === "user") {
    const payload = (body?.payload ?? {}) as { isMuted?: boolean; isVideoOff?: boolean };
    await prisma.meetParticipant.updateMany({
      where: { id: identity.participantId },
      data: {
        ...(typeof payload.isMuted === "boolean" ? { isMuted: payload.isMuted } : {}),
        ...(typeof payload.isVideoOff === "boolean" ? { isVideoOff: payload.isVideoOff } : {}),
        lastSeenAt: new Date(),
      },
    });
  }

  if (type === "speech") {
    const payload = (body?.payload ?? {}) as {
      text?: string;
      speakerName?: string;
    };
    const text = String(payload.text ?? "").trim();
    if (text) {
      const speakerName = String(payload.speakerName ?? identity.name ?? "Participant").trim() || identity.name;
      const labeled = `${speakerName}: ${text}`;
      // Merge rapid follow-ups from the same speaker into one attentive utterance.
      const recent = await prisma.meetNote.findFirst({
        where: {
          meetingId,
          source: "SPEECH",
          speakerPeerId: identity.peerId,
        },
        orderBy: { createdAt: "desc" },
      });
      const recentAgeMs = recent ? Date.now() - new Date(recent.createdAt).getTime() : Infinity;
      if (recent && recentAgeMs < 14_000) {
        const nextBody = `${recent.body.trim()} ${text}`.replace(/\s+/g, " ").trim();
        await prisma.meetNote.update({
          where: { id: recent.id },
          data: {
            body: nextBody.startsWith(`${speakerName}:`)
              ? nextBody
              : `${speakerName}: ${nextBody.replace(/^[^:]+:\s*/, "")}`,
            speakerName,
            speakerPeerId: identity.peerId,
          },
        });
      } else {
        await prisma.meetNote.create({
          data: {
            meetingId,
            authorUserId: identity.kind === "user" ? identity.userId : null,
            source: "SPEECH",
            body: labeled,
            speakerName,
            speakerPeerId: identity.peerId,
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, id: signal.id });
}
