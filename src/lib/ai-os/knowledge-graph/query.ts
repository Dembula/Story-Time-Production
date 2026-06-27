import { prisma } from "@/lib/prisma";
import type { GraphContext, KnowledgeEdgeRecord } from "./types";

function mapEdge(row: {
  id: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relation: string;
  label: string | null;
  weight: number;
  contentId: string | null;
  metadata: unknown;
}): KnowledgeEdgeRecord {
  return {
    id: row.id,
    fromType: row.fromType as KnowledgeEdgeRecord["fromType"],
    fromId: row.fromId,
    toType: row.toType as KnowledgeEdgeRecord["toType"],
    toId: row.toId,
    relation: row.relation,
    label: row.label,
    weight: row.weight,
    contentId: row.contentId,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  };
}

export async function getContentGraphEdges(contentId: string): Promise<KnowledgeEdgeRecord[]> {
  const rows = await prisma.knowledgeEdge.findMany({
    where: { contentId },
    orderBy: { weight: "desc" },
    take: 80,
  });
  return rows.map(mapEdge);
}

export async function getRelatedContentIds(contentId: string, limit = 12): Promise<Array<{ contentId: string; score: number }>> {
  const edges = await prisma.knowledgeEdge.findMany({
    where: { contentId, fromType: "content", fromId: contentId },
    select: { toType: true, toId: true, relation: true, weight: true },
  });

  const genreIds = edges.filter((e) => e.toType === "genre").map((e) => e.toId);
  const themeIds = edges.filter((e) => e.toType === "theme").map((e) => e.toId);
  const actorIds = edges.filter((e) => e.toType === "actor").map((e) => e.toId);
  const creatorId = edges.find((e) => e.relation === "created_by")?.toId;

  if (genreIds.length === 0 && themeIds.length === 0 && actorIds.length === 0 && !creatorId) {
    return [];
  }

  const related = await prisma.knowledgeEdge.findMany({
    where: {
      fromType: "content",
      fromId: { not: contentId },
      OR: [
        ...(genreIds.length ? [{ toType: "genre", toId: { in: genreIds } }] : []),
        ...(themeIds.length ? [{ toType: "theme", toId: { in: themeIds } }] : []),
        ...(actorIds.length ? [{ toType: "actor", toId: { in: actorIds }, relation: "features_actor" }] : []),
        ...(creatorId ? [{ relation: "created_by", toId: creatorId }] : []),
      ],
    },
    select: { fromId: true, relation: true, weight: true },
    take: 200,
  });

  const scores = new Map<string, number>();
  for (const row of related) {
    const bonus = row.relation === "created_by" ? 2 : row.relation === "features_actor" ? 1.5 : 1;
    scores.set(row.fromId, (scores.get(row.fromId) ?? 0) + row.weight * bonus);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, score]) => ({ contentId: id, score }));
}

export async function buildContentGraphContext(contentId: string): Promise<GraphContext | null> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: { id: true, title: true, published: true },
  });
  if (!content?.published) return null;

  const edges = await getContentGraphEdges(contentId);
  const relatedContent = await getRelatedContentIds(contentId, 8);

  const festivals = [...new Set(edges.filter((e) => e.toType === "festival").map((e) => e.label).filter(Boolean) as string[])];
  const rights = [...new Set(edges.filter((e) => e.toType === "rights").map((e) => e.label).filter(Boolean) as string[])];
  const castEdges = edges.filter((e) => e.toType === "character" || e.relation === "cast_in");
  const cast = castEdges.map((e) => ({
    name: e.label ?? e.toId,
    importance: (e.metadata?.importance as string | null) ?? null,
  }));

  const relatedTitles = relatedContent.length
    ? await prisma.content.findMany({
        where: { id: { in: relatedContent.map((r) => r.contentId) } },
        select: { id: true, title: true },
      })
    : [];

  const titleMap = new Map(relatedTitles.map((c) => [c.id, c.title]));

  return {
    contentId,
    title: content.title,
    edges,
    actors: [...new Set(edges.filter((e) => e.toType === "actor").map((e) => e.label).filter(Boolean) as string[])],
    genres: [...new Set(edges.filter((e) => e.toType === "genre").map((e) => e.label).filter(Boolean) as string[])],
    themes: [...new Set(edges.filter((e) => e.toType === "theme").map((e) => e.label).filter(Boolean) as string[])],
    festivals,
    rights,
    cast,
    relatedContent: relatedContent.map((r) => ({
      contentId: r.contentId,
      title: titleMap.get(r.contentId) ?? "Related title",
      score: r.score,
    })),
  };
}

export function formatGraphContextForPrompt(ctx: GraphContext): string {
  const lines = [
    `Title: ${ctx.title}`,
    ctx.genres.length ? `Genres: ${ctx.genres.join(", ")}` : null,
    ctx.themes.length ? `Themes: ${ctx.themes.join(", ")}` : null,
    ctx.festivals.length ? `Festivals: ${ctx.festivals.join(", ")}` : null,
    ctx.rights.length ? `Rights: ${ctx.rights.join("; ")}` : null,
    ctx.cast.length ? `Cast: ${ctx.cast.map((c) => c.name).join(", ")}` : null,
    ctx.actors.length ? `On-screen: ${ctx.actors.join(", ")}` : null,
    ctx.relatedContent.length
      ? `Related: ${ctx.relatedContent.map((r) => r.title).join(", ")}`
      : null,
  ].filter(Boolean);

  return lines.join("\n");
}
