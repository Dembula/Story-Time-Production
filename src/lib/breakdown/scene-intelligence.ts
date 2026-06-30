import type {
  BreakdownCategoryKey,
  SceneBreakdownAnalysis,
  SceneIntelligence,
} from "@/lib/breakdown/types";

type SceneRow = {
  id: string;
  number: string;
  heading: string | null;
  storyDay: number | null;
  intExt: string | null;
  timeOfDay: string | null;
  summary: string | null;
  pageCount: number | null;
  status: string;
  breakdownAnalysis?: unknown;
};

type CountsByScene = Record<string, Record<BreakdownCategoryKey, number>>;

const EMPTY_COUNTS = (): Record<BreakdownCategoryKey, number> => ({
  characters: 0,
  props: 0,
  locations: 0,
  wardrobe: 0,
  extras: 0,
  vehicles: 0,
  stunts: 0,
  sfx: 0,
  makeups: 0,
});

function parseAnalysis(raw: unknown): SceneBreakdownAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    purpose: typeof o.purpose === "string" ? o.purpose : null,
    storyImportance: (o.storyImportance as SceneBreakdownAnalysis["storyImportance"]) ?? null,
    emotionalTone: typeof o.emotionalTone === "string" ? o.emotionalTone : null,
    actionLevel: (o.actionLevel as SceneBreakdownAnalysis["actionLevel"]) ?? null,
    dialogueIntensity: (o.dialogueIntensity as SceneBreakdownAnalysis["dialogueIntensity"]) ?? null,
    productionRisks: Array.isArray(o.productionRisks) ? o.productionRisks.map(String) : [],
    aiFlags: Array.isArray(o.aiFlags) ? o.aiFlags.map(String) : [],
    departmentPrep: Array.isArray(o.departmentPrep) ? o.departmentPrep.map(String) : [],
    continuityRisks: Array.isArray(o.continuityRisks) ? o.continuityRisks.map(String) : [],
    budgetDrivers: Array.isArray(o.budgetDrivers) ? o.budgetDrivers.map(String) : [],
    recommendedPrep: Array.isArray(o.recommendedPrep) ? o.recommendedPrep.map(String) : [],
  };
}

function estimateRuntimeMinutes(pageCount: number | null, counts: Record<BreakdownCategoryKey, number>): number {
  const pages = pageCount ?? 1;
  const base = Math.max(1, Math.round(pages * 1.2));
  const actionBump = counts.stunts * 15 + counts.vehicles * 5 + counts.sfx * 8;
  return base + actionBump;
}

function estimateShootHours(runtimeMinutes: number, complexityScore: number): number {
  const setup = complexityScore >= 70 ? 3 : complexityScore >= 40 ? 2 : 1;
  return Math.round((runtimeMinutes / 60 + setup) * 10) / 10;
}

function computeComplexity(counts: Record<BreakdownCategoryKey, number>, analysis: SceneBreakdownAnalysis | null): number {
  let score =
    counts.characters * 3 +
    counts.props * 2 +
    counts.locations * 4 +
    counts.wardrobe * 2 +
    counts.extras * 3 +
    counts.vehicles * 5 +
    counts.stunts * 12 +
    counts.sfx * 8 +
    counts.makeups * 2;
  if (analysis?.actionLevel === "heavy") score += 15;
  if (analysis?.storyImportance === "pivotal") score += 5;
  score += (analysis?.productionRisks?.length ?? 0) * 4;
  return Math.min(100, score);
}

function ratingFromScore(score: number): SceneIntelligence["difficultyRating"] {
  if (score >= 75) return "extreme";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

function riskFromScore(score: number, stunts: number, sfx: number): SceneIntelligence["productionRisk"] {
  if (score >= 60 || stunts > 0) return "high";
  if (score >= 30 || sfx > 0) return "medium";
  return "low";
}

export function buildCountsByScene(
  items: Array<{ sceneId: string | null; category: BreakdownCategoryKey }>,
): CountsByScene {
  const out: CountsByScene = {};
  for (const item of items) {
    if (!item.sceneId) continue;
    if (!out[item.sceneId]) out[item.sceneId] = EMPTY_COUNTS();
    out[item.sceneId][item.category] += 1;
  }
  return out;
}

export function computeSceneIntelligence(
  scene: SceneRow,
  countsByScene: CountsByScene,
): SceneIntelligence {
  const counts = countsByScene[scene.id] ?? EMPTY_COUNTS();
  const analysis = parseAnalysis(scene.breakdownAnalysis);
  const totalTagged = Object.values(counts).reduce((a, b) => a + b, 0);
  const complexityScore = computeComplexity(counts, analysis);
  const estimatedRuntimeMinutes = estimateRuntimeMinutes(scene.pageCount, counts);
  const estimatedShootHours = estimateShootHours(estimatedRuntimeMinutes, complexityScore);
  const estimatedCrewSize = Math.min(
    80,
    8 +
      counts.characters * 2 +
      counts.extras +
      counts.stunts * 4 +
      counts.vehicles * 2 +
      counts.sfx * 3,
  );
  const weatherDependency =
    scene.intExt === "EXT" ||
    (analysis?.aiFlags ?? []).some((f) => /rain|weather|outdoor|storm/i.test(f));
  const hasSummary = Boolean(scene.summary?.trim());
  const hasMeta = Boolean(scene.intExt && scene.timeOfDay);
  const completionPercent = Math.min(
    100,
    Math.round(
      (hasSummary ? 25 : 0) +
        (hasMeta ? 15 : 0) +
        (totalTagged > 0 ? 40 : 0) +
        (analysis ? 20 : 0),
    ),
  );

  return {
    sceneId: scene.id,
    sceneNumber: scene.number,
    heading: scene.heading,
    intExt: scene.intExt,
    timeOfDay: scene.timeOfDay,
    storyDay: scene.storyDay,
    summary: scene.summary,
    pageCount: scene.pageCount,
    status: scene.status,
    estimatedRuntimeMinutes,
    estimatedShootHours,
    estimatedCrewSize,
    complexityScore,
    difficultyRating: ratingFromScore(complexityScore),
    productionRisk: riskFromScore(complexityScore, counts.stunts, counts.sfx),
    safetyRisk: counts.stunts > 0 ? "high" : counts.vehicles > 0 || counts.sfx > 0 ? "medium" : "low",
    weatherDependency,
    completionPercent,
    counts,
    analysis,
    visualAssetCount: 0,
    storyboardHref: null,
  };
}
