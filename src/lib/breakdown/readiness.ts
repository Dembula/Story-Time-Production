import type { ReadinessMetric, SceneIntelligence } from "@/lib/breakdown/types";

type ReadinessInput = {
  scenes: SceneIntelligence[];
  hasScreenplay: boolean;
  castLinkedCount: number;
  locationsBookedCount: number;
  scheduleDayCount: number;
  budgetLineCount: number;
};

export function computeReadinessMetrics(input: ReadinessInput): ReadinessMetric[] {
  const { scenes } = input;
  const sceneCount = scenes.length;
  const avgCompletion =
    sceneCount > 0 ? Math.round(scenes.reduce((a, s) => a + s.completionPercent, 0) / sceneCount) : 0;
  const scenesWithCast = scenes.filter((s) => s.counts.characters > 0).length;
  const scenesWithLocations = scenes.filter((s) => s.counts.locations > 0).length;
  const scenesWithProps = scenes.filter((s) => s.counts.props > 0).length;
  const scenesWithWardrobe = scenes.filter((s) => s.counts.wardrobe > 0).length;

  const pct = (num: number, den: number) => (den <= 0 ? 0 : Math.min(100, Math.round((num / den) * 100)));

  const scriptComplete = input.hasScreenplay ? Math.max(avgCompletion, sceneCount > 0 ? 85 : 40) : 0;
  const breakdownComplete = avgCompletion;
  const locationsConfirmed = pct(input.locationsBookedCount, Math.max(1, scenesWithLocations));
  const propsReady = pct(scenesWithProps, sceneCount);
  const wardrobeReady = pct(scenesWithWardrobe, sceneCount);
  const castingComplete = pct(input.castLinkedCount, Math.max(1, scenesWithCast));
  const scheduleReady = input.scheduleDayCount > 0 ? Math.min(100, 40 + input.scheduleDayCount * 8) : 0;
  const budgetComplete =
    input.budgetLineCount > 0 ? Math.min(100, 30 + input.budgetLineCount * 5) : breakdownComplete > 50 ? 45 : 0;

  const metrics: ReadinessMetric[] = [
    { id: "script", label: "Script synced", percent: scriptComplete },
    { id: "breakdown", label: "Breakdown complete", percent: breakdownComplete, detail: `${sceneCount} scenes` },
    { id: "locations", label: "Locations confirmed", percent: locationsConfirmed },
    { id: "props", label: "Props tagged", percent: propsReady },
    { id: "wardrobe", label: "Wardrobe tagged", percent: wardrobeReady },
    { id: "budget", label: "Budget prepared", percent: budgetComplete },
    { id: "schedule", label: "Schedule started", percent: scheduleReady },
    { id: "casting", label: "Casting linked", percent: castingComplete },
  ];

  return metrics;
}

export function overallReadinessPercent(metrics: ReadinessMetric[]): number {
  if (metrics.length === 0) return 0;
  return Math.round(metrics.reduce((a, m) => a + m.percent, 0) / metrics.length);
}
