import { prisma } from "@/lib/prisma";
import type { ModocLearningProfile } from "@/lib/modoc/learning";
import { resolveViewerProfileContext } from "@/lib/modoc/viewer-profile-resolver";

export type ViewerModocSuggestion = {
  id: string;
  title: string;
  body: string;
  /** Message sent to MODOC when the viewer taps this suggestion */
  prompt: string;
  priority: number;
};

export async function evaluateViewerModocContext(params: {
  userId: string;
  contentId?: string | null;
  learning?: ModocLearningProfile;
}): Promise<ViewerModocSuggestion[]> {
  const { viewerProfileId, profileAge } = await resolveViewerProfileContext(params.userId);
  const ageFilter = profileAge != null ? { minAge: { lte: profileAge } } : {};
  const suggestions: ViewerModocSuggestion[] = [];

  if (viewerProfileId) {
    const inProgress = await prisma.watchProgress.findMany({
      where: {
        viewerProfileId,
        positionSeconds: { gt: 60 },
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: {
        content: { select: { id: true, title: true, duration: true } },
      },
    });

    for (const p of inProgress) {
      const dur = p.durationSeconds ?? p.content.duration ?? 0;
      const pct = dur > 0 ? Math.round((p.positionSeconds / dur) * 100) : 0;
      if (pct < 5 || pct >= 95) continue;
      suggestions.push({
        id: `continue-${p.contentId}`,
        title: "Continue watching",
        body: `Pick up "${p.content.title}" where you left off (${pct}%).`,
        prompt: `Remind me where I left off in "${p.content.title}" and what happens next.`,
        priority: 95,
      });
    }
  }

  const watchlist = await prisma.watchlistItem.findMany({
    where: { userId: params.userId },
    orderBy: { createdAt: "desc" },
    take: 2,
    include: { content: { select: { id: true, title: true, type: true } } },
  });

  for (const item of watchlist) {
    suggestions.push({
      id: `watchlist-${item.contentId}`,
      title: "From your watchlist",
      body: `"${item.content.title}" is saved — want a quick preview of what it's about?`,
      prompt: `Tell me about "${item.content.title}" and why I might enjoy it.`,
      priority: 75,
    });
  }

  const recentWatch = await prisma.watchSession.findFirst({
    where: {
      userId: params.userId,
      ...(viewerProfileId ? { viewerProfileId } : {}),
    },
    orderBy: { startedAt: "desc" },
    include: { content: { select: { id: true, title: true, category: true, type: true } } },
  });

  if (recentWatch?.content) {
    suggestions.push({
      id: `similar-${recentWatch.contentId}`,
      title: "More like this",
      body: `Find titles similar to "${recentWatch.content.title}" that I haven't watched.`,
      prompt: `Suggest 3 titles similar to "${recentWatch.content.title}" that I haven't watched yet. Explain why each fits.`,
      priority: 85,
    });
  }

  if (params.contentId) {
    const current = await prisma.content.findFirst({
      where: { id: params.contentId, published: true },
      select: { id: true, title: true, scenes: { take: 1, select: { id: true } } },
    });
    if (current) {
      const hasScenes = current.scenes.length > 0;
      suggestions.push({
        id: `scenes-${current.id}`,
        title: hasScenes ? "Explore scenes" : "About this title",
        body: hasScenes
          ? `Ask about specific moments in "${current.title}".`
          : `Learn more about "${current.title}".`,
        prompt: hasScenes
          ? `What are the most memorable scenes in "${current.title}"? Summarize the key moments with timestamps.`
          : `Give me a spoiler-free overview of "${current.title}" and who might enjoy it.`,
        priority: 90,
      });
    }
  }

  const enriched = await prisma.content.findMany({
    where: {
      published: true,
      ...ageFilter,
      enrichment: { status: "READY" },
    },
    select: { id: true, title: true, enrichment: { select: { atmosphere: true } } },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  if (enriched[0]) {
    suggestions.push({
      id: `discover-${enriched[0].id}`,
      title: "Scene discovery",
      body: `Try: "Find a film with a ${enriched[0].enrichment?.atmosphere ?? "emotional"} atmosphere"`,
      prompt: "I'm in the mood for something atmospheric and cinematic — surprise me with a scene-led recommendation from Story Time.",
      priority: 50,
    });
  }

  suggestions.push({
    id: "scene-search",
    title: "Find by scene",
    body: "Describe a moment you remember — I'll search scene metadata across the catalogue.",
    prompt: "Help me find a title by describing a scene — ask me what I remember if you need more detail.",
    priority: 45,
  });

  const preferred = new Set(params.learning?.preferredSuggestions ?? []);
  return suggestions
    .sort((a, b) => {
      const boostA = preferred.has(a.id) ? 10 : 0;
      const boostB = preferred.has(b.id) ? 10 : 0;
      return b.priority + boostB - (a.priority + boostA);
    })
    .slice(0, 6);
}
