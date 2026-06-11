import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildModocGreeting, isSameCalendarDay } from "@/lib/modoc/greeting";
import { evaluateModocContext } from "@/lib/modoc/evaluate-context";
import { getModocLearning, learningHint, saveModocLearning } from "@/lib/modoc/learning";
import { CREATOR_VA_ROLE } from "@/lib/modoc/creator-va";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string })?.role ?? "SUBSCRIBER";
  if (role !== CREATOR_VA_ROLE) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  const learning = await getModocLearning(userId);
  const now = new Date();
  const lastGreeting = learning.lastGreetingAt ? new Date(learning.lastGreetingAt) : null;
  const isNewSessionToday = !lastGreeting || !isSameCalendarDay(lastGreeting, now);

  if (isNewSessionToday) {
    await saveModocLearning(userId, { lastGreetingAt: now.toISOString() });
  }

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

  const greeting = buildModocGreeting(user?.name, now);
  const hint = learningHint(learning);

  return NextResponse.json({
    greeting,
    isNewSessionToday,
    unreadVaCount,
    suggestions,
    learningHint: hint,
    selfAwareIntro: isNewSessionToday
      ? `${greeting}. I'm your Virtual Assistant — I work inside your creator workspace and only see your projects, tools, and schedule. Ask me anything or tap a suggestion below.`
      : null,
  });
}
