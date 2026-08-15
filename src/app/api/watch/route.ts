import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewerPlaybackState } from "@/lib/viewer-access";
import { resolveWatchCountsForCreatorRevenue } from "@/lib/revenue-eligible-watch";

async function resolveViewerUserId(session: {
  user?: { id?: string | null; email?: string | null } | null;
}): Promise<string | null> {
  if (session.user?.id) return session.user.id;
  if (!session.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function resolveViewerProfileId(userId: string, req: NextRequest): Promise<string | null> {
  const headerProfile = req.headers.get("x-st-viewer-profile")?.trim();
  if (headerProfile) {
    const profile = await prisma.viewerProfile.findFirst({
      where: { id: headerProfile, userId },
      select: { id: true },
    });
    if (profile) return profile.id;
  }

  const cookieStore = await cookies();
  const profileId = cookieStore.get("st_viewer_profile")?.value;
  if (!profileId) return null;
  const profile = await prisma.viewerProfile.findFirst({
    where: { id: profileId, userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

function coerceDurationSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/**
 * Record a watch slice for creator dashboards / revenue.
 * Web and Universe iOS/Android should POST every ~30s of playback (delta seconds).
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await resolveViewerUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const contentId = typeof body?.contentId === "string" ? body.contentId.trim() : "";
  const durationSeconds = coerceDurationSeconds(body?.durationSeconds);

  if (!contentId || durationSeconds == null || durationSeconds <= 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const playback = await getViewerPlaybackState(userId, contentId);
  if (!playback.canPlayContent) {
    return NextResponse.json({ error: "Playback access required" }, { status: 403 });
  }

  const viewerProfileId = await resolveViewerProfileId(userId, request);
  const countsForCreatorRevenue = await resolveWatchCountsForCreatorRevenue(userId, contentId);

  await prisma.watchSession.create({
    data: {
      userId,
      contentId,
      durationSeconds: Math.min(Math.floor(durationSeconds), 86400),
      viewerProfileId,
      countsForCreatorRevenue,
    },
  });

  return NextResponse.json({ ok: true });
}
