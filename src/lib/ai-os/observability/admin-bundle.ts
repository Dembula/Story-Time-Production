import { listActiveAgents } from "../agents/registry";
import { getAbEvaluationSummary } from "../evaluation/ab-model";
import { getAiObservabilitySummary } from "./log-request";
import { prisma } from "@/lib/prisma";

export type AiAdminDashboardBundle = {
  since: string;
  windowHours: number;
  flags: {
    ragEnabled: boolean;
    hybridRecommendations: boolean;
    memoryCacheEnabled: boolean;
    abTestingEnabled: boolean;
    redisConfigured: boolean;
  };
  summary: Awaited<ReturnType<typeof getAiObservabilitySummary>>;
  abEvaluation: Awaited<ReturnType<typeof getAbEvaluationSummary>>;
  activeAgents: ReturnType<typeof listActiveAgents>;
  graph: {
    edgeCount: number;
    chunkCount: number;
  };
  recentErrors: Array<{
    route: string;
    agentId: string | null;
    errorMessage: string | null;
    createdAt: string;
  }>;
};

export async function fetchAiAdminDashboardBundle(windowHours = 24): Promise<AiAdminDashboardBundle> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const [summary, abEvaluation, edgeCount, chunkCount, recentErrors] = await Promise.all([
    getAiObservabilitySummary(since),
    getAbEvaluationSummary(since),
    prisma.knowledgeEdge.count().catch(() => 0),
    prisma.knowledgeChunk.count().catch(() => 0),
    prisma.aiRequestLog
      .findMany({
        where: { createdAt: { gte: since }, success: false },
        select: {
          route: true,
          agentId: true,
          errorMessage: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      })
      .catch(() => []),
  ]);

  return {
    since: since.toISOString(),
    windowHours,
    flags: {
      ragEnabled: process.env.AI_RAG_ENABLED !== "false",
      hybridRecommendations: process.env.AI_HYBRID_RECOMMENDATIONS === "true",
      memoryCacheEnabled: process.env.AI_MEMORY_CACHE_ENABLED !== "false",
      abTestingEnabled: process.env.AI_AB_TESTING_ENABLED !== "false",
      redisConfigured: Boolean(process.env.REDIS_URL?.trim()),
    },
    summary,
    abEvaluation,
    activeAgents: listActiveAgents(),
    graph: { edgeCount, chunkCount },
    recentErrors: recentErrors.map((r) => ({
      route: r.route,
      agentId: r.agentId,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
