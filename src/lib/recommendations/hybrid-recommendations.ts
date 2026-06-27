import { prisma } from "@/lib/prisma";
import { cosineSimilarity, parseStoredEmbedding } from "@/lib/ai-metadata/embeddings";
import { getRelatedContentIds } from "@/lib/ai-os/knowledge-graph/query";
import { getViewerRecommendations } from "@/lib/viewer-recommendations";

const SEMANTIC_WEIGHT = 0.35;
const BEHAVIORAL_WEIGHT = 0.35;
const GRAPH_WEIGHT = 0.2;
const RATING_WEIGHT = 0.1;

type HybridCandidate = {
  id: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  videoUrl: string | null;
  category: string | null;
  type: string;
  creatorId: string;
  recScore: number;
  avgRating: number;
  _count: { ratings: number };
};

async function semanticScoresFromHistory(
  watchedContentIds: string[],
  candidateIds: string[],
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (watchedContentIds.length === 0 || candidateIds.length === 0) return scores;

  const [watchedEnrichment, candidateEnrichment] = await Promise.all([
    prisma.contentEnrichment.findMany({
      where: { contentId: { in: watchedContentIds }, status: "READY" },
      select: { contentId: true, embedding: true },
    }),
    prisma.contentEnrichment.findMany({
      where: { contentId: { in: candidateIds }, status: "READY" },
      select: { contentId: true, embedding: true },
    }),
  ]);

  const watchedVecs = watchedEnrichment
    .map((e) => parseStoredEmbedding(e.embedding))
    .filter((v): v is number[] => Boolean(v));

  if (watchedVecs.length === 0) return scores;

  const dim = watchedVecs[0]!.length;
  const centroid = new Array(dim).fill(0);
  for (const vec of watchedVecs) {
    for (let i = 0; i < dim; i++) centroid[i] += vec[i]!;
  }
  for (let i = 0; i < dim; i++) centroid[i] /= watchedVecs.length;

  for (const row of candidateEnrichment) {
    const vec = parseStoredEmbedding(row.embedding);
    if (!vec) continue;
    scores.set(row.contentId, cosineSimilarity(centroid, vec));
  }

  return scores;
}

/** Hybrid recommendations: behavioral + semantic + knowledge graph + ratings. */
export async function getHybridRecommendations(options: {
  userId: string;
  viewerProfileId: string | null;
  profileAge: number | null;
  limit?: number;
}): Promise<HybridCandidate[]> {
  const limit = options.limit ?? 12;

  const behavioral = await getViewerRecommendations(options);
  if (behavioral.length === 0) return [];

  const maxBehavioral = Math.max(...behavioral.map((b) => b.recScore), 1);
  const candidateIds = behavioral.map((b) => b.id);

  const watchedIds = await prisma.watchSession.findMany({
    where: { userId: options.userId },
    select: { contentId: true },
    distinct: ["contentId"],
    take: 30,
  });
  const watchedContentIds = watchedIds.map((w) => w.contentId);

  const [semanticMap, graphScores] = await Promise.all([
    semanticScoresFromHistory(watchedContentIds, candidateIds),
    Promise.all(
      watchedContentIds.slice(0, 5).map((id) => getRelatedContentIds(id, 10)),
    ).then((lists) => {
      const map = new Map<string, number>();
      for (const list of lists) {
        for (const item of list) {
          map.set(item.contentId, Math.max(map.get(item.contentId) ?? 0, item.score));
        }
      }
      return map;
    }),
  ]);

  const maxGraph = Math.max(...graphScores.values(), 1);

  const hybrid = behavioral.map((b) => {
    const behavioralNorm = b.recScore / maxBehavioral;
    const semantic = semanticMap.get(b.id) ?? 0;
    const graph = (graphScores.get(b.id) ?? 0) / maxGraph;
    const ratingNorm = Math.min(1, (b.avgRating ?? 0) / 5);

    const recScore =
      behavioralNorm * BEHAVIORAL_WEIGHT +
      semantic * SEMANTIC_WEIGHT +
      graph * GRAPH_WEIGHT +
      ratingNorm * RATING_WEIGHT;

    return { ...b, recScore };
  });

  hybrid.sort((a, b) => b.recScore - a.recScore);
  return hybrid.slice(0, limit);
}
