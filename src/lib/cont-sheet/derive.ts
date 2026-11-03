import {
  formatDurationMss,
  parseDurationToSec,
  type ContSheetTotals,
} from "@/lib/cont-sheet/types";

export type DeriveScene = {
  sceneCode: string;
  estimatedTiming: string;
  actualTiming: string;
  completionStatus: string;
  takes: Array<{
    slate: string;
    durationSec: number | null;
    printStatus?: string;
  }>;
};

export type DeriveDaySlice = {
  scenes: DeriveScene[];
  scenesSummary: {
    scheduled: string[];
    completed: string[];
    dropped: string[];
    added: string[];
    partlyShot: string[];
  };
  totals: ContSheetTotals;
};

function sumSec(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => (v != null && Number.isFinite(v) ? acc + v : acc), 0);
}

/** Rebuild scene strip chips + total/est/act + today bucket from live scene/take data. */
export function deriveContSheetMetrics<T extends DeriveDaySlice>(day: T): T {
  const scenes = day.scenes.map((scene) => {
    const takeSecs = scene.takes.map((t) => t.durationSec);
    const takeSum = sumSec(takeSecs);
    const hasTimedTakes = takeSecs.some((s) => s != null && Number.isFinite(s) && s >= 0);
    return {
      ...scene,
      actualTiming: hasTimedTakes ? formatDurationMss(takeSum) : scene.actualTiming,
    };
  });

  const buckets = {
    scheduled: [] as string[],
    completed: [] as string[],
    dropped: [] as string[],
    added: [] as string[],
    partlyShot: [] as string[],
  };

  for (const s of scenes) {
    const code = (s.sceneCode || "").trim() || "—";
    switch (s.completionStatus) {
      case "completed":
        buckets.completed.push(code);
        break;
      case "dropped":
        buckets.dropped.push(code);
        break;
      case "added":
        buckets.added.push(code);
        break;
      case "partlyShot":
        buckets.partlyShot.push(code);
        break;
      default:
        buckets.scheduled.push(code);
        break;
    }
  }

  const estSec = sumSec(scenes.map((s) => parseDurationToSec(s.estimatedTiming)));
  const actSec = sumSec(scenes.map((s) => parseDurationToSec(s.actualTiming)));
  const slateSet = new Set<string>();
  let takeCount = 0;
  let printCount = 0;
  for (const s of scenes) {
    for (const t of s.takes) {
      takeCount += 1;
      if (t.slate.trim()) slateSet.add(t.slate.trim().toUpperCase());
      const p = (t.printStatus ?? "").toUpperCase();
      if (p === "PRINT" || p === "P" || p === "CIRCLE") printCount += 1;
    }
  }

  const previous = day.totals.previous ?? {};
  const today = {
    scenesShot: buckets.completed.length + buckets.partlyShot.length,
    screenTime: formatDurationMss(actSec) || "",
    cards: takeCount || undefined,
    slates: slateSet.size || undefined,
    pages: day.totals.today?.pages ?? day.totals.totalPages ?? "",
  };

  const prevScenes = previous.scenesShot ?? 0;
  const prevScreen = parseDurationToSec(previous.screenTime) ?? 0;
  const prevCards = previous.cards ?? 0;
  const prevSlates = previous.slates ?? 0;

  const totals: ContSheetTotals = {
    ...day.totals,
    totalEstTime: formatDurationMss(estSec) || day.totals.totalEstTime || "",
    totalActTime: formatDurationMss(actSec) || "",
    previous,
    today,
    total: {
      scenesShot: prevScenes + (today.scenesShot ?? 0),
      screenTime: formatDurationMss(prevScreen + actSec) || "",
      cards: prevCards + (today.cards ?? 0),
      slates: prevSlates + (today.slates ?? 0),
      pages: day.totals.total?.pages ?? day.totals.totalPages ?? "",
    },
  };

  return {
    ...day,
    scenes,
    scenesSummary: buckets,
    totals,
  };
}
