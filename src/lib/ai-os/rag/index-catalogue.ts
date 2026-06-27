import { prisma } from "@/lib/prisma";
import { parseStoredEmbedding } from "@/lib/ai-metadata/embeddings";
import { upsertKnowledgeChunk } from "./index-chunk";

export async function indexCatalogueFromEnrichment(contentId: string): Promise<void> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      category: true,
      tags: true,
      enrichment: {
        select: {
          status: true,
          moodTags: true,
          atmosphere: true,
          pacing: true,
          narrativeJson: true,
          embedding: true,
        },
      },
    },
  });

  if (!content?.enrichment || content.enrichment.status !== "READY") return;

  const narrative = content.enrichment.narrativeJson as { summary?: string } | null;
  const moodTags = Array.isArray(content.enrichment.moodTags)
    ? (content.enrichment.moodTags as string[]).join(", ")
    : "";

  const chunkText = [
    content.title,
    content.description,
    content.type,
    content.category,
    content.tags,
    narrative?.summary,
    moodTags,
    content.enrichment.atmosphere,
    content.enrichment.pacing,
  ]
    .filter(Boolean)
    .join("\n");

  const existingEmbedding = parseStoredEmbedding(content.enrichment.embedding);

  await upsertKnowledgeChunk({
    chunkKey: `catalogue:${contentId}`,
    sourceType: "catalogue",
    sourceId: contentId,
    contentId,
    title: content.title,
    chunkText,
    metadata: {
      type: content.type,
      category: content.category,
      moodTags: content.enrichment.moodTags,
      atmosphere: content.enrichment.atmosphere,
    },
    embedding: existingEmbedding,
  });
}

export async function indexSceneChunk(sceneId: string): Promise<void> {
  const scene = await prisma.contentScene.findUnique({
    where: { id: sceneId },
    include: {
      content: { select: { id: true, title: true, published: true } },
    },
  });

  if (!scene?.content?.published) return;

  const actors = Array.isArray(scene.actors) ? (scene.actors as string[]).join(", ") : "";
  const tags = Array.isArray(scene.tags) ? (scene.tags as string[]).join(", ") : "";

  const chunkText = [
    scene.content.title,
    scene.summary,
    scene.mood,
    actors,
    tags,
    `Timestamp ${Math.floor(scene.startSeconds)}s–${Math.floor(scene.endSeconds)}s`,
  ]
    .filter(Boolean)
    .join("\n");

  await upsertKnowledgeChunk({
    chunkKey: `scene:${sceneId}`,
    sourceType: "scene",
    sourceId: sceneId,
    contentId: scene.contentId,
    title: `${scene.content.title} — scene`,
    chunkText,
    metadata: {
      startSeconds: scene.startSeconds,
      endSeconds: scene.endSeconds,
      mood: scene.mood,
    },
  });
}

export async function indexScenesForContent(contentId: string): Promise<number> {
  const scenes = await prisma.contentScene.findMany({
    where: { contentId },
    select: { id: true },
  });
  for (const s of scenes) {
    await indexSceneChunk(s.id);
  }
  return scenes.length;
}
