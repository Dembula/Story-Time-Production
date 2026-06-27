import type { ModocTaskKind } from "@/lib/modoc/task-kind";

export type AbExperimentVariant = "control" | "variant_a";

/** Deterministic A/B bucket from user id (sticky per user). */
export function resolveAbExperimentVariant(userId: string | null | undefined): AbExperimentVariant {
  if (!userId || process.env.AI_AB_TESTING_ENABLED === "false") return "control";

  const ratio = Math.min(100, Math.max(0, parseInt(process.env.AI_AB_VARIANT_RATIO ?? "50", 10)));
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const bucket = hash % 100;
  return bucket < ratio ? "variant_a" : "control";
}

/** Model chain override for A/B variant. */
export function abModelOverride(
  taskKind: ModocTaskKind,
  variant: AbExperimentVariant,
): string | null {
  if (variant !== "variant_a") return null;

  const byTask: Partial<Record<ModocTaskKind, string | undefined>> = {
    creative: process.env.OPENROUTER_AB_CREATIVE_MODEL,
    extraction: process.env.OPENROUTER_AB_EXTRACTION_MODEL,
    logic: process.env.OPENROUTER_AB_LOGIC_MODEL,
    chat: process.env.OPENROUTER_AB_CHAT_MODEL,
    default: process.env.OPENROUTER_AB_DEFAULT_MODEL,
  };

  const model = byTask[taskKind] ?? process.env.OPENROUTER_AB_DEFAULT_MODEL;
  return model?.trim() || null;
}

export type AbEvaluationRow = {
  variant: AbExperimentVariant;
  modelUsed: string | null;
  requestCount: number;
  avgLatencyMs: number;
  errorRate: number;
  ragHitRate: number;
};

export async function getAbEvaluationSummary(since: Date): Promise<{
  enabled: boolean;
  rows: AbEvaluationRow[];
  recommendation: string;
}> {
  const { prisma } = await import("@/lib/prisma");

  const rows = await prisma.aiRequestLog.findMany({
    where: {
      createdAt: { gte: since },
      route: "modoc/chat",
      experimentVariant: { not: null },
    },
    select: {
      experimentVariant: true,
      modelUsed: true,
      latencyMs: true,
      success: true,
      ragHitCount: true,
    },
    take: 10000,
  });

  if (rows.length === 0) {
    return {
      enabled: process.env.AI_AB_TESTING_ENABLED !== "false",
      rows: [],
      recommendation: "Insufficient A/B data — need modoc/chat requests with experimentVariant set.",
    };
  }

  const buckets = new Map<string, AbEvaluationRow>();

  for (const row of rows) {
    const variant = (row.experimentVariant ?? "control") as AbExperimentVariant;
    const key = `${variant}::${row.modelUsed ?? "unknown"}`;
    const existing = buckets.get(key) ?? {
      variant,
      modelUsed: row.modelUsed,
      requestCount: 0,
      avgLatencyMs: 0,
      errorRate: 0,
      ragHitRate: 0,
    };
    existing.requestCount += 1;
    existing.avgLatencyMs += row.latencyMs;
    if (!row.success) existing.errorRate += 1;
    if (row.ragHitCount > 0) existing.ragHitRate += 1;
    buckets.set(key, existing);
  }

  const result = [...buckets.values()].map((r) => ({
    ...r,
    avgLatencyMs: Math.round(r.avgLatencyMs / r.requestCount),
    errorRate: Math.round((r.errorRate / r.requestCount) * 1000) / 10,
    ragHitRate: Math.round((r.ragHitRate / r.requestCount) * 1000) / 10,
  }));

  const variantA = result.filter((r) => r.variant === "variant_a");
  const control = result.filter((r) => r.variant === "control");
  const avgLatencyA =
    variantA.length > 0
      ? variantA.reduce((s, r) => s + r.avgLatencyMs, 0) / variantA.length
      : 0;
  const avgLatencyC =
    control.length > 0
      ? control.reduce((s, r) => s + r.avgLatencyMs, 0) / control.length
      : 0;

  let recommendation = "Continue collecting data before promoting a variant.";
  if (variantA.length > 0 && control.length > 0) {
    if (avgLatencyA < avgLatencyC * 0.9) {
      recommendation = "Variant A shows lower latency — consider promoting AB models if quality holds.";
    } else if (avgLatencyA > avgLatencyC * 1.15) {
      recommendation = "Variant A is slower — keep control as default or try different AB models.";
    }
  }

  return {
    enabled: process.env.AI_AB_TESTING_ENABLED !== "false",
    rows: result,
    recommendation,
  };
}
