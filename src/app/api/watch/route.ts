import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewerPlaybackState } from "@/lib/viewer-access";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { contentId, durationSeconds } = body;

  if (!contentId || typeof durationSeconds !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const playback = await getViewerPlaybackState(session.user.id, contentId);
  if (!playback.canPlayContent) {
    return NextResponse.json({ error: "Playback access required" }, { status: 403 });
  }

  let viewerProfileId: string | null = null;
  const cookieStore = await cookies();
  const profileId = cookieStore.get("st_viewer_profile")?.value;
  if (profileId) {
    const profile = await prisma.viewerProfile.findFirst({
      where: { id: profileId, userId: session.user.id },
      select: { id: true },
    });
    if (profile) viewerProfileId = profile.id;
  }

  await prisma.watchSession.create({
    data: {
      userId: session.user.id,
      contentId,
      durationSeconds: Math.min(durationSeconds, 86400),
      viewerProfileId,
    },
  });

  return NextResponse.json({ ok: true });
}
