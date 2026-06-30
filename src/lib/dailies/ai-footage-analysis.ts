import type {
  AiFootageInsight,
  ClipProductionMetadata,
  DailiesClipRecord,
  DailiesDepartmentId,
  DailiesNoteRecord,
  DailiesProductionInsight,
} from "@/lib/dailies/types";

function parseFlags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((f) => typeof f === "string");
  return [];
}

export function analyzeFootageClip(input: {
  clip: {
    title: string | null;
    takeStatus: string;
    takeFlags: unknown;
    metadata: unknown;
    durationMs: number | null;
    notes: Array<{ body: string; category: string | null; priority: string }>;
  };
  sceneHeading: string | null;
  continuityNoteCount: number;
}): AiFootageInsight[] {
  const insights: AiFootageInsight[] = [];
  const meta = (input.clip.metadata ?? {}) as ClipProductionMetadata;
  const flags = parseFlags(input.clip.takeFlags);
  const noteBodies = input.clip.notes.map((n) => n.body.toLowerCase()).join(" ");

  if (input.clip.takeStatus === "reshoot") {
    insights.push({
      id: "reshoot-flagged",
      severity: "warning",
      category: "production",
      title: "Reshoot flagged",
      body: "This take is marked for reshoot — confirm coverage plan with production management.",
      confidence: 1,
    });
  }

  if (flags.includes("circle_take") || input.clip.takeStatus === "circle") {
    insights.push({
      id: "circle-take",
      severity: "opportunity",
      category: "editorial",
      title: "Circle take selected",
      body: "Marked for editorial — ensure metadata and sync are complete before handoff.",
      confidence: 1,
    });
  }

  const audioKeywords = ["audio", "boom", "distortion", "clipping", "adr", "noise"];
  if (audioKeywords.some((k) => noteBodies.includes(k))) {
    insights.push({
      id: "audio-concern",
      severity: "warning",
      category: "audio",
      title: "Audio issue noted",
      body: "Review notes mention audio — verify dialogue clarity and boom visibility.",
      confidence: 0.85,
    });
  }

  const continuityKeywords = ["continuity", "wardrobe", "hair", "makeup", "prop"];
  if (continuityKeywords.some((k) => noteBodies.includes(k)) || input.continuityNoteCount > 0) {
    insights.push({
      id: "continuity-watch",
      severity: "warning",
      category: "continuity",
      title: "Continuity attention",
      body: "Continuity notes exist for this scene — cross-check wardrobe, props, and blocking.",
      confidence: 0.75,
    });
  }

  if (!meta.resolution && !meta.codec) {
    insights.push({
      id: "metadata-gap",
      severity: "info",
      category: "technical",
      title: "Metadata incomplete",
      body: "Add camera, lens, and codec metadata for full technical review.",
      confidence: 0.9,
    });
  }

  if (input.clip.durationMs != null && input.clip.durationMs < 3000) {
    insights.push({
      id: "short-clip",
      severity: "info",
      category: "technical",
      title: "Very short clip",
      body: "Clip under 3 seconds — verify this is a full take and not a false start.",
      confidence: 0.6,
    });
  }

  if (input.sceneHeading && /EXT\./i.test(input.sceneHeading) && !meta.location) {
    insights.push({
      id: "ext-no-location",
      severity: "info",
      category: "locations",
      title: "Exterior without location tag",
      body: "Exterior scene — add location metadata for weather and permit tracking.",
      confidence: 0.7,
    });
  }

  return insights;
}

export function generateProductionInsights(
  clips: DailiesClipRecord[],
  sceneCount: number,
  notes: DailiesNoteRecord[],
): DailiesProductionInsight[] {
  const insights: DailiesProductionInsight[] = [];

  const pending = clips.filter((c) => c.takeStatus === "pending").length;
  if (pending > 0) {
    insights.push({
      id: "pending-reviews",
      severity: "warning",
      title: `${pending} take(s) awaiting review`,
      body: "Complete dailies review before wrap to avoid editorial delays.",
      departmentIds: ["director", "producer"],
    });
  }

  const scenesWithClips = new Set(clips.map((c) => c.sceneNumber).filter(Boolean));
  if (sceneCount > 0 && scenesWithClips.size < sceneCount) {
    insights.push({
      id: "coverage-gap",
      severity: "warning",
      title: "Scene coverage may be incomplete",
      body: `${scenesWithClips.size} of ${sceneCount} script scenes have uploaded dailies.`,
      departmentIds: ["director", "producer"],
    });
  }

  const circleTakes = clips.filter((c) => c.takeStatus === "circle" || c.takeFlags.includes("circle_take"));
  if (circleTakes.length > 0) {
    insights.push({
      id: "circle-ready",
      severity: "opportunity",
      title: `${circleTakes.length} circle take(s) ready for editorial`,
      body: "Approved circle takes can flow to post-production and footage bins.",
      departmentIds: ["editorial"],
    });
  }

  const criticalNotes = notes.filter((n) => n.priority === "critical" && !n.resolved);
  if (criticalNotes.length > 0) {
    insights.push({
      id: "critical-notes",
      severity: "warning",
      title: `${criticalNotes.length} critical review note(s) open`,
      body: "Resolve critical issues before advancing schedule or budget.",
      departmentIds: ["producer", "director"],
    });
  }

  const reshoots = clips.filter((c) => c.takeStatus === "reshoot");
  if (reshoots.length > 0) {
    insights.push({
      id: "reshoots",
      severity: "warning",
      title: `${reshoots.length} reshoot(s) required`,
      body: "Schedule pickup days and update production scheduling.",
      departmentIds: ["producer", "director"],
      sceneNumbers: [...new Set(reshoots.map((c) => c.sceneNumber).filter(Boolean) as string[])],
    });
  }

  return insights;
}

export function buildDailyReport(input: {
  shootDayDate: string;
  clips: DailiesClipRecord[];
  notes: DailiesNoteRecord[];
  insights: AiFootageInsight[];
}): {
  shootDayDate: string;
  completedScenes: string[];
  approvedTakes: number;
  circleTakes: number;
  reshootsNeeded: number;
  technicalIssues: string[];
  performanceHighlights: string[];
  continuityAlerts: string[];
  productionRisks: string[];
  tomorrowPrep: string[];
} {
  const sceneNums = [...new Set(input.clips.map((c) => c.sceneNumber).filter(Boolean) as string[])];
  return {
    shootDayDate: input.shootDayDate,
    completedScenes: sceneNums,
    approvedTakes: input.clips.filter((c) => c.takeStatus === "approved").length,
    circleTakes: input.clips.filter((c) => c.takeStatus === "circle").length,
    reshootsNeeded: input.clips.filter((c) => c.takeStatus === "reshoot").length,
    technicalIssues: input.insights.filter((i) => i.category === "technical" || i.category === "audio").map((i) => i.title),
    performanceHighlights: input.notes
      .filter((n) => n.category === "performance")
      .slice(0, 5)
      .map((n) => n.body),
    continuityAlerts: input.insights.filter((i) => i.category === "continuity").map((i) => i.body),
    productionRisks: input.insights.filter((i) => i.severity === "warning").map((i) => i.title),
    tomorrowPrep: [
      input.clips.some((c) => c.takeStatus === "pending") ? "Clear pending dailies reviews" : "Editorial handoff for circle takes",
      input.clips.some((c) => c.takeStatus === "reshoot") ? "Confirm reshoot schedule with AD" : "Advance next shooting day prep",
    ],
  };
}
