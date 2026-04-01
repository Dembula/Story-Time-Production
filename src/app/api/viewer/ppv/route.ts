import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  VIEWER_MODELS,
  VIEWER_PLAN_CONFIG,
  getViewerPlaybackState,
  hasActivePpvViewerModel,
  isPpvEligibleContent,
} from "@/lib/viewer-access";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string })?.role;
  if (role !== "SUBSCRIBER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { contentId?: string } | null;
  const contentId = body?.contentId?.trim();
  if (!contentId) {
    return NextResponse.json({ error: "contentId is required" }, { status: 400 });
  }

  const content = await prisma.content.findUnique({
    where: { id: contentId, published: true },
    select: { id: true, title: true, type: true, videoUrl: true },
  });

  if (!content || !content.videoUrl) {
    return NextResponse.json({ error: "Title not found" }, { status: 404 });
  }

  if (!isPpvEligibleContent(content.type)) {
    return NextResponse.json({ error: "This title is not available for pay per view" }, { status: 400 });
  }

  const playback = await getViewerPlaybackState(session.user.id, content.id);
  if (!playback.subscription || playback.viewerModel !== VIEWER_MODELS.PPV || !hasActivePpvViewerModel(playback.subscription)) {
    return NextResponse.json({ error: "Switch this account to Pay Per View before purchasing titles" }, { status: 403 });
  }

  if (playback.hasActivePpvAccess) {
    return NextResponse.json({ access: playback.contentAccess, alreadyOwned: true });
  }

  await prisma.viewerContentAccess.create({
    data: {
      userId: session.user.id,
      contentId: content.id,
      accessType: "PPV_FILM",
      amount: VIEWER_PLAN_CONFIG.PPV_FILM.price,
      currency: "ZAR",
      status: "COMPLETED",
      purchasedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.json({
    success: true,
    requiresPayment: false,
    alreadyOwned: true,
  });
}
