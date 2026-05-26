import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveViewerProfileId } from "@/lib/watch-progress";
import { getViewerPlaybackState } from "@/lib/viewer-access";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentId = request.nextUrl.searchParams.get("contentId");
  if (!contentId) {
    return NextResponse.json({ error: "contentId required" }, { status: 400 });
  }

  const profileId = await getActiveViewerProfileId(session.user.id);
  if (!profileId) {
    return NextResponse.json({ positionSeconds: 0, durationSeconds: null });
  }

  const row = await prisma.watchProgress.findUnique({
    where: { viewerProfileId_contentId: { viewerProfileId: profileId, contentId } },
    select: { positionSeconds: true, durationSeconds: true, updatedAt: true },
  });

  return NextResponse.json(
    row ?? { positionSeconds: 0, durationSeconds: null, updatedAt: null },
  );
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const contentId = typeof body?.contentId === "string" ? body.contentId : "";
  const positionSeconds = typeof body?.positionSeconds === "number" ? body.positionSeconds : NaN;
  const durationSeconds =
    typeof body?.durationSeconds === "number" ? body.durationSeconds : undefined;

  if (!contentId || !Number.isFinite(positionSeconds) || positionSeconds < 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const playback = await getViewerPlaybackState(session.user.id, contentId);
  if (!playback.canPlayContent) {
    return NextResponse.json({ error: "Playback access required" }, { status: 403 });
  }

  const profileId = await getActiveViewerProfileId(session.user.id);
  if (!profileId) {
    return NextResponse.json({ error: "Profile required" }, { status: 400 });
  }

  const pos = Math.min(Math.floor(positionSeconds), 86400);
  const dur =
    durationSeconds != null && Number.isFinite(durationSeconds)
      ? Math.min(Math.floor(durationSeconds), 86400)
      : null;

  await prisma.watchProgress.upsert({
    where: { viewerProfileId_contentId: { viewerProfileId: profileId, contentId } },
    create: {
      userId: session.user.id,
      contentId,
      viewerProfileId: profileId,
      positionSeconds: pos,
      durationSeconds: dur,
    },
    update: {
      positionSeconds: pos,
      ...(dur != null ? { durationSeconds: dur } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
