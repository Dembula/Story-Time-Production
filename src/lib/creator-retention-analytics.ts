import { prisma } from "@/lib/prisma";

const CHECKPOINTS = [10, 25, 50, 75, 90, 100] as const;

export type CreatorRetentionSnapshot = {
  sampleSize: number;
  /** % of viewers who reached at least each checkpoint of runtime */
  curve: { checkpoint: number; retainedPct: number }[];
  byTitle: Array<{
    contentId: string;
    title: string;
    sampleSize: number;
    medianCompletionPct: number;
    curve: { checkpoint: number; retainedPct: number }[];
  }>;
};

function completionPct(positionSeconds: number, durationSeconds: number | null | undefined): number | null {
  const dur = durationSeconds ?? 0;
  if (dur < 60) return null;
  return Math.min(100, Math.round((positionSeconds / dur) * 100));
}

function buildCurve(completions: number[]): CreatorRetentionSnapshot["curve"] {
  if (completions.length === 0) {
    return CHECKPOINTS.map((checkpoint) => ({ checkpoint, retainedPct: 0 }));
  }
  const n = completions.length;
  return CHECKPOINTS.map((checkpoint) => {
    const retained = completions.filter((p) => p >= checkpoint).length;
    return { checkpoint, retainedPct: Math.round((retained / n) * 1000) / 10 };
  });
}

export async function getCreatorRetentionSnapshot(
  creatorId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<CreatorRetentionSnapshot> {
  const rows = await prisma.watchProgress.findMany({
    where: {
      updatedAt: { gte: windowStart, lte: windowEnd },
      content: { creatorId },
    },
    select: {
      positionSeconds: true,
      durationSeconds: true,
      contentId: true,
      content: { select: { title: true, duration: true } },
    },
    take: 5000,
  });

  const completions: number[] = [];
  const byContent = new Map<string, { title: string; values: number[] }>();

  for (const row of rows) {
    const dur = row.durationSeconds ?? row.content.duration;
    const pct = completionPct(row.positionSeconds, dur);
    if (pct == null) continue;
    completions.push(pct);
    const bucket = byContent.get(row.contentId) ?? { title: row.content.title, values: [] };
    bucket.values.push(pct);
    byContent.set(row.contentId, bucket);
  }

  if (completions.length === 0) {
    const sessions = await prisma.watchSession.findMany({
      where: {
        startedAt: { gte: windowStart, lte: windowEnd },
        content: { creatorId },
      },
      select: {
        durationSeconds: true,
        contentId: true,
        content: { select: { title: true, duration: true } },
      },
      take: 5000,
    });
    for (const s of sessions) {
      const pct = completionPct(s.durationSeconds, s.content.duration);
      if (pct == null) continue;
      completions.push(pct);
      const bucket = byContent.get(s.contentId) ?? { title: s.content.title, values: [] };
      bucket.values.push(pct);
      byContent.set(s.contentId, bucket);
    }
  }

  const byTitle = [...byContent.entries()]
    .map(([contentId, { title, values }]) => {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = sorted[Math.floor(sorted.length / 2)] ?? 0;
      return {
        contentId,
        title,
        sampleSize: values.length,
        medianCompletionPct: mid,
        curve: buildCurve(values),
      };
    })
    .filter((t) => t.sampleSize >= 3)
    .sort((a, b) => b.sampleSize - a.sampleSize)
    .slice(0, 8);

  return {
    sampleSize: completions.length,
    curve: buildCurve(completions),
    byTitle,
  };
}
