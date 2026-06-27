import { prisma } from "@/lib/prisma";
import { deleteContentGraphEdges, upsertKnowledgeEdge } from "./upsert-edge";
import { parseMoodThemes, parseTagsList, slugEntityId } from "./utils";

/** Build knowledge graph edges for a published catalogue title. */
export async function syncContentKnowledgeGraph(contentId: string): Promise<number> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      title: true,
      published: true,
      category: true,
      tags: true,
      creatorId: true,
      creator: { select: { id: true, name: true } },
      enrichment: { select: { moodTags: true, atmosphere: true } },
      scenes: {
        select: {
          id: true,
          summary: true,
          mood: true,
          actors: true,
          startSeconds: true,
          endSeconds: true,
        },
      },
    },
  });

  if (!content?.published) return 0;

  await deleteContentGraphEdges(contentId);
  let edgeCount = 0;

  await upsertKnowledgeEdge({
    fromType: "content",
    fromId: contentId,
    toType: "creator",
    toId: content.creatorId,
    relation: "created_by",
    label: content.creator?.name ?? undefined,
    contentId,
  });
  edgeCount++;

  const genres = new Set<string>();
  if (content.category) genres.add(content.category);
  for (const tag of parseTagsList(content.tags)) {
    if (tag.length <= 40) genres.add(tag);
  }

  for (const genre of genres) {
    const genreId = slugEntityId(genre);
    if (!genreId) continue;
    await upsertKnowledgeEdge({
      fromType: "content",
      fromId: contentId,
      toType: "genre",
      toId: genreId,
      relation: "has_genre",
      label: genre,
      contentId,
    });
    edgeCount++;
  }

  const themes = parseMoodThemes(content.enrichment?.moodTags);
  if (content.enrichment?.atmosphere) themes.push(content.enrichment.atmosphere);

  for (const theme of themes) {
    const themeId = slugEntityId(theme);
    if (!themeId) continue;
    await upsertKnowledgeEdge({
      fromType: "content",
      fromId: contentId,
      toType: "theme",
      toId: themeId,
      relation: "has_theme",
      label: theme,
      contentId,
    });
    edgeCount++;
  }

  for (const scene of content.scenes) {
    await upsertKnowledgeEdge({
      fromType: "content",
      fromId: contentId,
      toType: "scene",
      toId: scene.id,
      relation: "has_scene",
      label: scene.summary?.slice(0, 80) ?? undefined,
      contentId,
      metadata: {
        startSeconds: scene.startSeconds,
        endSeconds: scene.endSeconds,
        mood: scene.mood,
      },
    });
    edgeCount++;

    const actors = Array.isArray(scene.actors) ? (scene.actors as string[]) : [];
    for (const actorName of actors) {
      const actorId = slugEntityId(actorName);
      if (!actorId) continue;
      await upsertKnowledgeEdge({
        fromType: "scene",
        fromId: scene.id,
        toType: "actor",
        toId: actorId,
        relation: "features_actor",
        label: actorName,
        contentId,
      });
      await upsertKnowledgeEdge({
        fromType: "content",
        fromId: contentId,
        toType: "actor",
        toId: actorId,
        relation: "features_actor",
        label: actorName,
        contentId,
        weight: 0.8,
      });
      edgeCount += 2;
    }
  }

  return edgeCount;
}

export async function syncPublishedCatalogueGraph(limit = 100): Promise<{ content: number; edges: number }> {
  const rows = await prisma.content.findMany({
    where: { published: true },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  let edges = 0;
  for (const row of rows) {
    edges += await syncContentKnowledgeGraph(row.id);
  }
  return { content: rows.length, edges };
}
