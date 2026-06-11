import "server-only";

import { prisma } from "@/lib/prisma";
import { semanticSearchCatalogue } from "@/lib/discovery/semantic-search";
import {
  MAX_VIEWER_CATALOG_IN_CONTEXT,
  MAX_VIEWER_CONTINUE_WATCHING,
  MAX_VIEWER_DIALOGUE_LINES,
  MAX_VIEWER_SCENES_IN_CONTEXT,
  MAX_VIEWER_SEMANTIC_MATCHES,
  MAX_VIEWER_WATCH_HISTORY,
  MAX_VIEWER_WATCHLIST,
} from "./learning-limits";
import { resolveViewerProfileContext } from "./viewer-profile-resolver";

type DialogueLine = { startSeconds: number; endSeconds: number; text: string };

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function scoreSceneMatch(
  query: string,
  scene: { summary: string | null; mood: string | null; tags: unknown; content: { title: string } },
): number {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  let score = 0;
  const hay = [
    scene.summary ?? "",
    scene.mood ?? "",
    Array.isArray(scene.tags) ? (scene.tags as string[]).join(" ") : "",
    scene.content.title,
  ]
    .join(" ")
    .toLowerCase();

  for (const w of words) {
    if (hay.includes(w)) score += 1;
  }
  if (scene.summary?.toLowerCase().includes(q)) score += 3;
  return score;
}

async function searchScenesForQuery(
  query: string,
  ageFilter: Record<string, unknown>,
  semanticContentIds: string[],
): Promise<
  Array<{
    contentId: string;
    title: string;
    startSeconds: number;
    endSeconds: number;
    summary: string;
    mood: string | null;
    score: number;
  }>
> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const words = trimmed.split(/\s+/).filter((w) => w.length > 2).slice(0, 6);
  const sceneOr =
    words.length > 0
      ? words.flatMap((w) => [
          { summary: { contains: w, mode: "insensitive" as const } },
          { mood: { contains: w, mode: "insensitive" as const } },
        ])
      : [{ summary: { contains: trimmed, mode: "insensitive" as const } }];

  const [keywordScenes, semanticScenes] = await Promise.all([
    prisma.contentScene.findMany({
      where: {
        content: { published: true, ...ageFilter },
        OR: sceneOr,
      },
      include: {
        content: { select: { id: true, title: true, type: true } },
      },
      take: MAX_VIEWER_SCENES_IN_CONTEXT,
    }),
    semanticContentIds.length > 0
      ? prisma.contentScene.findMany({
          where: { contentId: { in: semanticContentIds } },
          include: {
            content: { select: { id: true, title: true, type: true } },
          },
          take: MAX_VIEWER_SCENES_IN_CONTEXT,
        })
      : Promise.resolve([]),
  ]);

  const merged = new Map<
    string,
    {
      contentId: string;
      title: string;
      startSeconds: number;
      endSeconds: number;
      summary: string;
      mood: string | null;
      score: number;
    }
  >();

  for (const scene of [...keywordScenes, ...semanticScenes]) {
    const key = `${scene.contentId}:${Math.round(scene.startSeconds)}`;
    const score = scoreSceneMatch(trimmed, scene);
    if (score <= 0 && !semanticContentIds.includes(scene.contentId)) continue;
    const existing = merged.get(key);
    const boosted = score + (semanticContentIds.includes(scene.contentId) ? 2 : 0);
    if (!existing || boosted > existing.score) {
      merged.set(key, {
        contentId: scene.contentId,
        title: scene.content.title,
        startSeconds: scene.startSeconds,
        endSeconds: scene.endSeconds,
        summary: scene.summary ?? "(scene)",
        mood: scene.mood,
        score: boosted,
      });
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_VIEWER_SCENES_IN_CONTEXT);
}

async function searchDialogueForQuery(
  query: string,
  contentIds: string[],
  ageFilter: Record<string, unknown>,
): Promise<
  Array<{ contentId: string; title: string; startSeconds: number; endSeconds: number; text: string }>
> {
  const q = query.trim().toLowerCase();
  if (q.length < 4) return [];

  const whereContentIds = contentIds.length > 0 ? { in: contentIds } : undefined;

  const enrichments = await prisma.contentEnrichment.findMany({
    where: {
      status: "READY",
      ...(whereContentIds ? { contentId: whereContentIds } : {}),
      content: { published: true, ...ageFilter },
    },
    select: {
      contentId: true,
      dialogueIndex: true,
      content: { select: { title: true } },
    },
    take: whereContentIds ? contentIds.length : 40,
  });

  const hits: Array<{
    contentId: string;
    title: string;
    startSeconds: number;
    endSeconds: number;
    text: string;
  }> = [];

  for (const row of enrichments) {
    const lines = (row.dialogueIndex ?? []) as DialogueLine[];
    for (const line of lines) {
      if (!line.text?.toLowerCase().includes(q)) continue;
      hits.push({
        contentId: row.contentId,
        title: row.content.title,
        startSeconds: line.startSeconds,
        endSeconds: line.endSeconds,
        text: line.text.slice(0, 160),
      });
      if (hits.length >= MAX_VIEWER_DIALOGUE_LINES) return hits;
    }
  }

  return hits;
}

/** Read-only viewer catalogue snapshot with scene-level search for MODOC chat. */
export async function buildViewerDatabaseContext(
  userId: string,
  options?: {
    focusContentId?: string | null;
    userQuery?: string | null;
  },
): Promise<string> {
  const { profileAge, viewerProfileId, profileName } = await resolveViewerProfileContext(userId);
  const ageFilter = profileAge != null ? { minAge: { lte: profileAge } } : {};
  const userQuery = options?.userQuery?.trim() ?? "";
  const focusContentId = options?.focusContentId ?? null;

  const [
    semanticMatches,
    watchHistory,
    watchlist,
    continueWatching,
    focusContent,
    catalogSample,
    enrichedCount,
  ] = await Promise.all([
    userQuery.length >= 3
      ? semanticSearchCatalogue({ query: userQuery, limit: MAX_VIEWER_SEMANTIC_MATCHES, profileAge })
      : Promise.resolve([]),
    prisma.watchSession.findMany({
      where: {
        userId,
        ...(viewerProfileId ? { viewerProfileId } : {}),
      },
      orderBy: { startedAt: "desc" },
      take: MAX_VIEWER_WATCH_HISTORY,
      include: {
        content: {
          select: { id: true, title: true, type: true, category: true },
        },
      },
    }),
    prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_VIEWER_WATCHLIST,
      include: {
        content: {
          select: { id: true, title: true, type: true, category: true },
        },
      },
    }),
    viewerProfileId
      ? prisma.watchProgress.findMany({
          where: {
            viewerProfileId,
            positionSeconds: { gt: 0 },
          },
          orderBy: { updatedAt: "desc" },
          take: MAX_VIEWER_CONTINUE_WATCHING,
          include: {
            content: {
              select: { id: true, title: true, duration: true },
            },
          },
        })
      : Promise.resolve([]),
    focusContentId
      ? prisma.content.findFirst({
          where: { id: focusContentId, published: true, ...ageFilter },
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            category: true,
            tags: true,
            duration: true,
            enrichment: {
              select: {
                moodTags: true,
                atmosphere: true,
                pacing: true,
                narrativeJson: true,
                status: true,
              },
            },
            scenes: {
              orderBy: { startSeconds: "asc" },
              select: {
                startSeconds: true,
                endSeconds: true,
                summary: true,
                mood: true,
                tags: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    prisma.content.findMany({
      where: { published: true, ...ageFilter },
      select: {
        id: true,
        title: true,
        type: true,
        category: true,
        tags: true,
        enrichment: { select: { status: true, atmosphere: true, moodTags: true } },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_VIEWER_CATALOG_IN_CONTEXT,
    }),
    prisma.contentEnrichment.count({
      where: { status: "READY", content: { published: true, ...ageFilter } },
    }),
  ]);

  const semanticIds = semanticMatches.map((m) => m.id);
  const watchedIds = new Set(watchHistory.map((w) => w.contentId));

  const [matchedScenes, dialogueHits] =
    userQuery.length >= 3
      ? await Promise.all([
          searchScenesForQuery(userQuery, ageFilter, semanticIds),
          searchDialogueForQuery(userQuery, semanticIds, ageFilter),
        ])
      : [[], []];

  const sections: string[] = [];

  sections.push(`**Viewer profile:** ${profileName ?? "default"}${profileAge != null ? ` (age ${profileAge})` : ""}`);
  sections.push(`**Catalogue:** ${catalogSample.length}+ published titles · ${enrichedCount} with AI scene metadata`);

  if (focusContent) {
    const moodTags = Array.isArray(focusContent.enrichment?.moodTags)
      ? (focusContent.enrichment.moodTags as string[]).join(", ")
      : "";
    sections.push(`
**Currently viewing:** "${focusContent.title}" (id=${focusContent.id})
Type: ${focusContent.type} · Category: ${focusContent.category ?? "—"} · Duration: ${focusContent.duration ?? "?"}s
Description: ${(focusContent.description ?? "").slice(0, 400)}
Mood/atmosphere: ${moodTags || focusContent.enrichment?.atmosphere || "—"} · Pacing: ${focusContent.enrichment?.pacing ?? "—"}
Open at: /browse/content/${focusContent.id}`);

    if (focusContent.scenes.length > 0) {
      const sceneLines = focusContent.scenes
        .map(
          (s) =>
            `  · ${formatTimestamp(s.startSeconds)}–${formatTimestamp(s.endSeconds)}: ${s.summary ?? "scene"}${s.mood ? ` [${s.mood}]` : ""}`,
        )
        .join("\n");
      sections.push(`**Scenes in this title:**\n${sceneLines}`);
    }
  }

  if (semanticMatches.length > 0) {
    const lines = semanticMatches
      .map(
        (m) =>
          `- id=${m.id} | "${m.title}" | ${m.type}${m.category ? ` · ${m.category}` : ""}${m.atmosphere ? ` · ${m.atmosphere}` : ""}${watchedIds.has(m.id) ? " · WATCHED" : ""}`,
      )
      .join("\n");
    sections.push(`**Semantic matches for "${userQuery}":**\n${lines}`);
  }

  if (matchedScenes.length > 0) {
    const lines = matchedScenes
      .map(
        (s) =>
          `- "${s.title}" (id=${s.contentId}) @ ${formatTimestamp(s.startSeconds)}: ${s.summary}${s.mood ? ` · mood: ${s.mood}` : ""}`,
      )
      .join("\n");
    sections.push(`**Scene matches for "${userQuery}":**\n${lines}`);
  }

  if (dialogueHits.length > 0) {
    const lines = dialogueHits
      .map(
        (d) =>
          `- "${d.title}" (id=${d.contentId}) @ ${formatTimestamp(d.startSeconds)}: "${d.text}"`,
      )
      .join("\n");
    sections.push(`**Dialogue matches for "${userQuery}":**\n${lines}`);
  }

  if (continueWatching.length > 0) {
    const lines = continueWatching
      .map((p) => {
        const dur = p.durationSeconds ?? p.content.duration ?? 0;
        const pct = dur > 0 ? Math.round((p.positionSeconds / dur) * 100) : 0;
        if (pct >= 95) return null;
        return `- "${p.content.title}" (id=${p.contentId}) · ${pct}% watched · resume /browse/content/${p.contentId}`;
      })
      .filter(Boolean)
      .join("\n");
    if (lines) sections.push(`**Continue watching:**\n${lines}`);
  }

  if (watchHistory.length > 0) {
    const lines = watchHistory
      .map(
        (w) =>
          `- "${w.content.title}" (${w.content.type}${w.content.category ? `, ${w.content.category}` : ""}) id=${w.content.id}`,
      )
      .join("\n");
    sections.push(`**Recent watch history:**\n${lines}`);
  }

  if (watchlist.length > 0) {
    const lines = watchlist
      .map((w) => `- "${w.content.title}" id=${w.content.id}`)
      .join("\n");
    sections.push(`**Watchlist:**\n${lines}`);
  }

  const catalogLines = catalogSample
    .map((c) => {
      const mood = Array.isArray(c.enrichment?.moodTags)
        ? (c.enrichment.moodTags as string[]).slice(0, 3).join(", ")
        : c.enrichment?.atmosphere ?? "";
      const enriched = c.enrichment?.status === "READY" ? " · scenes✓" : "";
      return `- id=${c.id} | "${c.title}" | ${c.type} | ${c.category ?? ""} | tags=${c.tags ?? ""}${mood ? ` | mood=${mood}` : ""}${enriched}`;
    })
    .join("\n");
  sections.push(`**Published catalogue sample (only suggest titles from Story Time):**\n${catalogLines}`);

  return sections.join("\n\n");
}

export const MODOC_VIEWER_INSTRUCTIONS = `
## Viewer MODOC capabilities — use database context below

You are MODOC for a **viewer** on Story Time browse. You have read-only access to:
- The **published catalogue** (titles, tags, mood, enrichment status)
- **Per-scene metadata** (timestamps, summaries, mood) when enrichment is READY
- **Dialogue index** snippets for quote/line searches
- This viewer's **watch history**, **watchlist**, and **continue-watching** progress
- **Semantic search results** and **scene matches** for their current question

### How to help
1. **Scene search**: When they describe a moment ("the chase on the roof", "emotional goodbye at the train"), use **Scene matches** and **Dialogue matches** first. Cite the title, timestamp, and content id. Tell them to open /browse/content/[id] — mention the approximate timestamp if helpful.
2. **Title discovery**: Recommend from the catalogue and semantic matches only. Prefer unwatched titles based on their history. Explain *why* (mood, genre, similar to X they watched).
3. **Continue watching**: Proactively mention in-progress titles when relevant.
4. **Currently viewing**: If they are on a title page, answer questions about that film using its scene list and description.
5. **Age safety**: Only suggest titles appropriate for their profile age. Never suggest adult content to under-age profiles.

### Response format
- Always include \`/browse/content/[id]\` links when suggesting a title (replace [id] with real id from context).
- For scene matches, include timestamp like "around 12:34".
- Be concise and cinematic — viewers want quick answers, not essays.
- If no scene data exists for a title, say so honestly and infer from description/tags, noting it's less precise.
- Never invent content ids or titles not in the context.`;
