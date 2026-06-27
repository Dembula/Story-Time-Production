import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { InputJsonValue } from "@/lib/prisma-json";

export type AiRequestLogInput = {
  userId?: string | null;
  route: string;
  agentId?: string | null;
  modelUsed?: string | null;
  taskKind?: string | null;
  experimentVariant?: string | null;
  latencyMs: number;
  ragHitCount?: number;
  vectorBackend?: string | null;
  graphEdgeCount?: number;
  success?: boolean;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Fire-and-forget AI observability log — never blocks caller on failure. */
export function logAiRequest(input: AiRequestLogInput): void {
  void prisma.aiRequestLog
    .create({
      data: {
        id: randomUUID(),
        userId: input.userId ?? null,
        route: input.route,
        agentId: input.agentId ?? null,
        modelUsed: input.modelUsed ?? null,
        taskKind: input.taskKind ?? null,
        experimentVariant: input.experimentVariant ?? null,
        latencyMs: input.latencyMs,
        ragHitCount: input.ragHitCount ?? 0,
        vectorBackend: input.vectorBackend ?? null,
        graphEdgeCount: input.graphEdgeCount ?? 0,
        success: input.success ?? true,
        errorMessage: input.errorMessage ?? null,
        metadata: (input.metadata ?? undefined) as InputJsonValue | undefined,
      },
    })
    .catch((e) => {
      if (process.env.NODE_ENV === "development") {
        console.error("AiRequestLog write failed:", e);
      }
    });
}

export async function getAiObservabilitySummary(since: Date): Promise<{
  totalRequests: number;
  avgLatencyMs: number;
  ragHitRate: number;
  errorRate: number;
  byAgent: Record<string, number>;
  byRoute: Record<string, number>;
  byTaskKind: Record<string, number>;
  memoryCacheHitRate: number;
}> {
  const rows = await prisma.aiRequestLog.findMany({
    where: { createdAt: { gte: since } },
    select: {
      latencyMs: true,
      ragHitCount: true,
      success: true,
      agentId: true,
      route: true,
      taskKind: true,
      metadata: true,
    },
    take: 5000,
  });

  if (rows.length === 0) {
    return {
      totalRequests: 0,
      avgLatencyMs: 0,
      ragHitRate: 0,
      errorRate: 0,
      byAgent: {},
      byRoute: {},
      byTaskKind: {},
      memoryCacheHitRate: 0,
    };
  }

  const totalRequests = rows.length;
  const avgLatencyMs = Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / totalRequests);
  const ragHits = rows.filter((r) => r.ragHitCount > 0).length;
  const errors = rows.filter((r) => !r.success).length;
  const byAgent: Record<string, number> = {};
  const byRoute: Record<string, number> = {};
  const byTaskKind: Record<string, number> = {};
  let memoryCacheHits = 0;
  let memoryCacheSamples = 0;

  for (const row of rows) {
    const agentKey = row.agentId ?? "unknown";
    byAgent[agentKey] = (byAgent[agentKey] ?? 0) + 1;
    byRoute[row.route] = (byRoute[row.route] ?? 0) + 1;
    if (row.taskKind) {
      byTaskKind[row.taskKind] = (byTaskKind[row.taskKind] ?? 0) + 1;
    }
    const meta = row.metadata as Record<string, unknown> | null;
    if (meta && typeof meta.memoryCacheHit === "boolean") {
      memoryCacheSamples += 1;
      if (meta.memoryCacheHit) memoryCacheHits += 1;
    }
  }

  return {
    totalRequests,
    avgLatencyMs,
    ragHitRate: Math.round((ragHits / totalRequests) * 1000) / 10,
    errorRate: Math.round((errors / totalRequests) * 1000) / 10,
    byAgent,
    byRoute,
    byTaskKind,
    memoryCacheHitRate:
      memoryCacheSamples > 0
        ? Math.round((memoryCacheHits / memoryCacheSamples) * 1000) / 10
        : 0,
  };
}
