import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildModocGreeting, isSameCalendarDay } from "@/lib/modoc/greeting";
import { evaluateModocContext } from "@/lib/modoc/evaluate-context";
import { evaluateViewerModocContext } from "@/lib/modoc/evaluate-viewer-context";
import { getModocLearning, learningHint, saveModocLearning } from "@/lib/modoc/learning";
import { getPlaybookRuleCount, migrateJsonLearningToDb } from "@/lib/modoc/learning-store";
import { CREATOR_VA_ROLE } from "@/lib/modoc/creator-va";
import { VIEWER_VA_ROLE } from "@/lib/modoc/viewer-va";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string })?.role ?? VIEWER_VA_ROLE;
  const scope = req.nextUrl.searchParams.get("scope");
  const contentId = req.nextUrl.searchParams.get("contentId");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const learning = await getModocLearning(userId);
  await migrateJsonLearningToDb(userId, learning);
  const playbookRuleCount = await getPlaybookRuleCount(userId);
  const now = new Date();
  const lastGreeting = learning.lastGreetingAt ? new Date(learning.lastGreetingAt) : null;
  const isNewSessionToday = !lastGreeting || !isSameCalendarDay(lastGreeting, now);

  if (isNewSessionToday) {
    await saveModocLearning(userId, { lastGreetingAt: now.toISOString() });
  }

  const greeting = buildModocGreeting(user?.name, now);
  const hint = learningHint(learning);

  if (role === VIEWER_VA_ROLE || scope === "browse") {
    const [unreadAiCount, suggestions] = await Promise.all([
      prisma.notification.count({
        where: { userId, type: "AI_SUGGESTION", read: false },
      }),
      evaluateViewerModocContext({
        userId,
        contentId,
        learning,
      }),
    ]);

    return NextResponse.json({
      greeting,
      isNewSessionToday,
      unreadVaCount: unreadAiCount,
      suggestions,
      learningHint: hint,
      playbookRuleCount,
      interactionCount: learning.interactionCount ?? 0,
      selfAwareIntro: isNewSessionToday
        ? `${greeting}. I'm MODOC — your Story Time discovery assistant. I can search scenes across the catalogue, find titles by mood or moment, and recommend based on what you've been watching.`
        : null,
    });
  }

  if (role !== CREATOR_VA_ROLE) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId");

  const [unreadVaCount, suggestions] = await Promise.all([
    prisma.notification.count({
      where: { userId, type: "VA_SUGGESTION", read: false },
    }),
    evaluateModocContext({
      userId,
      role,
      projectId,
      learning,
    }),
  ]);

  return NextResponse.json({
    greeting,
    isNewSessionToday,
    unreadVaCount,
    suggestions,
    learningHint: hint,
    playbookRuleCount,
    interactionCount: learning.interactionCount ?? 0,
    selfAwareIntro: isNewSessionToday
      ? `${greeting}. I'm your Virtual Assistant — I work inside your creator workspace and only see your projects, tools, and schedule. Ask me anything or tap a suggestion below.`
      : null,
  });
}
