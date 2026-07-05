import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify-user";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const role = (session.user as { role?: string }).role;

  const requests = await prisma.syncRequest.findMany({
    where: role === "MUSIC_CREATOR"
      ? { musicCreatorId: userId }
      : { requesterId: userId },
    include: {
      track: { select: { id: true, title: true, artistName: true, genre: true, coverUrl: true } },
      requester: { select: { id: true, name: true, email: true } },
      musicCreator: { select: { id: true, name: true, email: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { trackId, note, projectName, projectType, usageType, budget } = body;

  if (!trackId) return NextResponse.json({ error: "trackId required" }, { status: 400 });

  const track = await prisma.musicTrack.findUnique({
    where: { id: trackId },
    select: { creatorId: true, title: true },
  });
  if (!track) return NextResponse.json({ error: "Track not found" }, { status: 404 });

  const request = await prisma.syncRequest.create({
    data: {
      trackId,
      requesterId: session.user.id,
      musicCreatorId: track.creatorId,
      note: note || null,
      projectName: projectName || null,
      projectType: projectType || null,
      usageType: usageType || null,
      budget: budget ? Number(budget) : null,
    },
    include: {
      track: { select: { title: true } },
      requester: { select: { name: true } },
    },
  });

  await notifyUser({
    userId: track.creatorId,
    type: "SYNC_REQUEST",
    title: "New sync licensing request",
    body: `${request.requester.name ?? "A creator"} wants to license "${track.title}"${projectName ? ` for ${projectName}` : ""}.`,
    metadata: {
      url: "/music-creator/sync-requests",
      requestId: request.id,
    },
  });

  return NextResponse.json(request);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { requestId, status } = body;

  if (!requestId || !status) return NextResponse.json({ error: "requestId and status required" }, { status: 400 });

  const existing = await prisma.syncRequest.findUnique({
    where: { id: requestId },
    include: {
      track: { select: { title: true } },
      requester: { select: { id: true, name: true } },
      musicCreator: { select: { name: true } },
    },
  });
  if (!existing || existing.musicCreatorId !== session.user.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const updated = await prisma.syncRequest.update({
    where: { id: requestId },
    data: { status },
  });

  if (status === "APPROVED") {
    await notifyUser({
      userId: existing.requesterId,
      type: "SYNC_REQUEST_APPROVED",
      title: "Sync request approved",
      body: `${existing.musicCreator.name ?? "The composer"} approved your request to use "${existing.track.title}". Complete payment to finalize the license.`,
      metadata: {
        url: "/creator/music?tab=requests",
        requestId: existing.id,
      },
    });
  } else if (status === "DECLINED") {
    await notifyUser({
      userId: existing.requesterId,
      type: "SYNC_REQUEST_DECLINED",
      title: "Sync request declined",
      body: `Your request to use "${existing.track.title}" was declined.`,
      metadata: {
        url: "/creator/music?tab=requests",
        requestId: existing.id,
      },
    });
  }

  return NextResponse.json(updated);
}
