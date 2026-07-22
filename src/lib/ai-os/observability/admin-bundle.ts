import { listActiveAgents } from "../agents/registry";
import { getAbEvaluationSummary } from "../evaluation/ab-model";
import { getAiObservabilitySummary } from "./log-request";
import { fetchAiUsageInsights, type AiUsageInsights } from "./admin-usage-insights";
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
  usage: AiUsageInsights;
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
  recentRequests: Array<{
    id: string;
    route: string;
    agentId: string | null;
    modelUsed: string | null;
    taskKind: string | null;
    userId: string | null;
    latencyMs: number;
    success: boolean;
    ragHitCount: number;
    createdAt: string;
  }>;
};

export async function fetchAiAdminDashboardBundle(windowHours = 24): Promise<AiAdminDashboardBundle> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const [summary, usage, abEvaluation, edgeCount, chunkCount, recentErrors, recentRequests] =
    await Promise.all([
      getAiObservabilitySummary(since),
      fetchAiUsageInsights(since),
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
      prisma.aiRequestLog
        .findMany({
          where: { createdAt: { gte: since } },
          select: {
            id: true,
            route: true,
            agentId: true,
            modelUsed: true,
            taskKind: true,
            userId: true,
            latencyMs: true,
            success: true,
            ragHitCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 40,
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
    usage,
    abEvaluation,
    activeAgents: listActiveAgents(),
    graph: { edgeCount, chunkCount },
    recentErrors: recentErrors.map((r) => ({
      route: r.route,
      agentId: r.agentId,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    })),
    recentRequests: recentRequests.map((r) => ({
      id: r.id,
      route: r.route,
      agentId: r.agentId,
      modelUsed: r.modelUsed,
      taskKind: r.taskKind,
      userId: r.userId,
      latencyMs: r.latencyMs,
      success: r.success,
      ragHitCount: r.ragHitCount,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
