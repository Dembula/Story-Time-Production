import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Throttle: max unread AI suggestions to keep; don't create if we already have this many. */
const MAX_UNREAD_AI_SUGGESTIONS = 5;
/** Only add new suggestions if the most recent AI_SUGGESTION is older than this (ms). */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * GET: Ensure the viewer has AI-suggested films as notifications (based on watch history).
 * Call from the browse layout or on browse page load (e.g. once per session).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const recentAi = await prisma.notification.findMany({
      where: { userId, type: "AI_SUGGESTION" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    const unreadAiCount = await prisma.notification.count({
      where: { userId, type: "AI_SUGGESTION", read: false },
    });
    if (unreadAiCount >= MAX_UNREAD_AI_SUGGESTIONS) {
      return NextResponse.json({ created: 0, message: "Already have enough suggestions" });
    }
    const lastCreated = recentAi[0]?.createdAt?.getTime() ?? 0;
    if (Date.now() - lastCreated < COOLDOWN_MS && unreadAiCount > 0) {
      return NextResponse.json({ created: 0, message: "Cooldown" });
    }

    const watched = await prisma.watchSession.findMany({
      where: { userId },
      distinct: ["contentId"],
      select: { contentId: true, content: { select: { category: true, type: true } } },
    });
    const watchedIds = watched.map((w) => w.contentId);
    const categories = [...new Set(watched.map((w) => w.content?.category).filter(Boolean))] as string[];
    const types = [...new Set(watched.map((w) => w.content?.type).filter(Boolean))] as string[];

    const whereClause: { published: boolean; id?: { notIn: string[] }; OR?: Array<{ category?: { in: string[] }; type?: { in: string[] } }> } = {
      published: true,
    };
    if (watchedIds.length > 0) {
      whereClause.id = { notIn: watchedIds };
      const orClauses: Array<{ category?: { in: string[] }; type?: { in: string[] } }> = [];
      if (categories.length > 0) orClauses.push({ category: { in: categories } });
      if (types.length > 0) orClauses.push({ type: { in: types } });
      if (orClauses.length > 0) whereClause.OR = orClauses;
    }

    const toSuggest = await prisma.content.findMany({
      where: whereClause,
      select: { id: true, title: true, type: true, category: true },
      take: 3,
      orderBy: { createdAt: "desc" },
    });

    if (toSuggest.length === 0) {
      return NextResponse.json({ created: 0, message: "No new suggestions" });
    }

    const created: string[] = [];
    for (const c of toSuggest) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type: "AI_SUGGESTION",
          metadata: { contains: c.id },
        },
      });
      if (existing) continue;

      const categoryLabel = c.category || c.type || "content";
      await prisma.notification.create({
        data: {
          userId,
          type: "AI_SUGGESTION",
          title: `Suggested for you: ${c.title}`,
          body: `Based on your watching — ${categoryLabel}.`,
          metadata: JSON.stringify({ contentId: c.id, url: `/browse/content/${c.id}` }),
        },
      });
      created.push(c.id);
    }

    return NextResponse.json({ created: created.length, ids: created });
  } catch (e) {
    console.error("Viewer suggestions error:", e);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
