import {
  ALL_PROJECT_TOOLS,
  POST_PRODUCTION_HUB_TOOLS,
  PRE_PRODUCTION_TOOLS,
  PRODUCTION_TOOLS,
  type ProjectPhase,
  type ProjectToolMeta,
} from "@/lib/project-tools";

export type StoredToolProgress = {
  toolId: string;
  phase: string;
  status: string;
  percent: number;
};

export type ProjectUsageSignals = {
  ideaCount: number;
  scriptCount: number;
  scriptReviewCount: number;
  sceneCount: number;
  breakdownCharacterCount: number;
  budgetLineCount: number;
  shootDayCount: number;
  castingRoleCount: number;
  crewNeedCount: number;
  equipmentItemCount: number;
  contractCount: number;
  taskCount: number;
  tableReadCount: number;
  riskItemCount: number;
  callSheetCount: number;
  incidentCount: number;
  dailiesClipCount: number;
  contentLinked: boolean;
};

export type ResolvedToolStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "SKIPPED";

export type ResolvedToolProgress = {
  toolId: string;
  phase: ProjectPhase;
  status: ResolvedToolStatus;
  percent: number;
};

/** Pipeline step from project.status (DEVELOPMENT → PRODUCTION → POST_PRODUCTION). */
export function projectStatusToPipelineStep(status: string | null | undefined): 1 | 2 | 3 {
  const s = (status ?? "DEVELOPMENT").toUpperCase();
  if (s === "POST_PRODUCTION") return 3;
  if (s === "PRODUCTION") return 2;
  return 1;
}

export function toolPhaseToPipelineStep(phase: ProjectPhase): 1 | 2 | 3 {
  if (phase === "POST_PRODUCTION") return 3;
  if (phase === "PRODUCTION") return 2;
  return 1;
}

function inferFromSignals(toolId: string, signals: ProjectUsageSignals): ResolvedToolStatus {
  switch (toolId) {
    case "idea-development":
      return signals.ideaCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "script-writing":
      return signals.scriptCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "script-review":
      return signals.scriptReviewCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "script-breakdown":
      return signals.breakdownCharacterCount > 0 || signals.sceneCount > 0
        ? signals.breakdownCharacterCount > 0
          ? "COMPLETE"
          : "IN_PROGRESS"
        : "NOT_STARTED";
    case "budget-builder":
      return signals.budgetLineCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "production-scheduling":
      return signals.shootDayCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "casting-portal":
      return signals.castingRoleCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "crew-marketplace":
      return signals.crewNeedCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "location-marketplace":
      return signals.sceneCount > 0 ? "IN_PROGRESS" : "NOT_STARTED";
    case "equipment-planning":
      return signals.equipmentItemCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "legal-contracts":
      return signals.contractCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "table-reads":
      return signals.tableReadCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "production-workspace":
      return signals.taskCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "risk-insurance":
      return signals.riskItemCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "control-center":
      return signals.incidentCount > 0 || signals.shootDayCount > 0 ? "IN_PROGRESS" : "NOT_STARTED";
    case "call-sheet-generator":
      return signals.callSheetCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "on-set-tasks":
      return signals.taskCount > 0 ? "IN_PROGRESS" : "NOT_STARTED";
    case "equipment-tracking":
      return signals.equipmentItemCount > 0 ? "IN_PROGRESS" : "NOT_STARTED";
    case "shoot-progress":
      return signals.shootDayCount > 0 ? "IN_PROGRESS" : "NOT_STARTED";
    case "continuity-manager":
      return signals.shootDayCount > 0 ? "IN_PROGRESS" : "NOT_STARTED";
    case "incident-reporting":
      return signals.incidentCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "dailies-review":
      return signals.dailiesClipCount > 0 ? "COMPLETE" : "NOT_STARTED";
    case "distribution":
      return signals.contentLinked ? "COMPLETE" : "NOT_STARTED";
    case "music-scoring":
      return "NOT_STARTED";
    default:
      return "NOT_STARTED";
  }
}

function mergeStoredAndInferred(
  stored: StoredToolProgress | undefined,
  inferred: ResolvedToolStatus,
): ResolvedToolStatus {
  const storedStatus = stored?.status?.toUpperCase();
  if (storedStatus === "COMPLETE") return "COMPLETE";
  if (storedStatus === "IN_PROGRESS") return inferred === "COMPLETE" ? "COMPLETE" : "IN_PROGRESS";
  if (inferred === "COMPLETE") return "COMPLETE";
  if (inferred === "IN_PROGRESS") return "IN_PROGRESS";
  return "NOT_STARTED";
}

export function resolveToolProgressForProject(input: {
  projectStatus: string;
  stored: StoredToolProgress[];
  signals: ProjectUsageSignals;
  hubToolsOnly?: boolean;
}): ResolvedToolProgress[] {
  const activeStep = projectStatusToPipelineStep(input.projectStatus);
  const storedMap = new Map(input.stored.map((p) => [p.toolId, p]));
  const tools = input.hubToolsOnly
    ? [
        ...PRE_PRODUCTION_TOOLS,
        ...PRODUCTION_TOOLS,
        ...POST_PRODUCTION_HUB_TOOLS,
      ]
    : ALL_PROJECT_TOOLS;

  return tools.map((tool) => {
    const stored = storedMap.get(tool.id);
    const inferred = inferFromSignals(tool.id, input.signals);
    let status = mergeStoredAndInferred(stored, inferred);
    const toolStep = toolPhaseToPipelineStep(tool.phase);

    if (toolStep < activeStep && status === "NOT_STARTED") {
      status = "SKIPPED";
    }

    const percent =
      stored?.percent ??
      (status === "COMPLETE" ? 100 : status === "IN_PROGRESS" ? 50 : status === "SKIPPED" ? 0 : 0);

    return { toolId: tool.id, phase: tool.phase, status, percent };
  });
}

export type PipelineRollup = {
  activeStep: 1 | 2 | 3;
  totalTracked: number;
  completeCount: number;
  inProgressCount: number;
  skippedCount: number;
  notStartedCount: number;
  progressPercent: number;
  phaseSummaries: Record<
    "pre" | "prod" | "post",
    { done: number; skipped: number; inProgress: number; total: number }
  >;
};

export function buildPipelineRollup(
  resolved: ResolvedToolProgress[],
  projectStatus: string,
): PipelineRollup {
  const activeStep = projectStatusToPipelineStep(projectStatus);
  const trackedIds = new Set<string>(
    [...PRE_PRODUCTION_TOOLS, ...PRODUCTION_TOOLS, ...POST_PRODUCTION_HUB_TOOLS].map((t) => t.id),
  );

  const relevant = resolved.filter((r) => {
    if (!trackedIds.has(r.toolId)) return false;
    const step = toolPhaseToPipelineStep(r.phase);
    return step <= activeStep;
  });

  const completeCount = relevant.filter((r) => r.status === "COMPLETE").length;
  const inProgressCount = relevant.filter((r) => r.status === "IN_PROGRESS").length;
  const skippedCount = relevant.filter((r) => r.status === "SKIPPED").length;
  const notStartedCount = relevant.filter((r) => r.status === "NOT_STARTED").length;

  const accounted = completeCount + skippedCount;
  const progressPercent =
    relevant.length > 0 ? Math.round((accounted / relevant.length) * 100) : 0;

  const summarize = (tools: ProjectToolMeta[]) => {
    const rows = resolved.filter((r) => tools.some((t) => t.id === r.toolId));
    return {
      done: rows.filter((r) => r.status === "COMPLETE").length,
      skipped: rows.filter((r) => r.status === "SKIPPED").length,
      inProgress: rows.filter((r) => r.status === "IN_PROGRESS").length,
      total: tools.length,
    };
  };

  return {
    activeStep,
    totalTracked: relevant.length,
    completeCount,
    inProgressCount,
    skippedCount,
    notStartedCount,
    progressPercent,
    phaseSummaries: {
      pre: summarize(PRE_PRODUCTION_TOOLS),
      prod: summarize(PRODUCTION_TOOLS),
      post: summarize(POST_PRODUCTION_HUB_TOOLS),
    },
  };
}

export function toDisplayStatus(
  status: ResolvedToolStatus,
  toolId: string,
  ideasCount: number,
): "done" | "in_progress" | "not_started" | "linked" | "skipped" {
  if (status === "SKIPPED") return "skipped";
  if (status === "COMPLETE") {
    if (toolId === "idea-development" && ideasCount > 0) return "linked";
    return "done";
  }
  if (status === "IN_PROGRESS") return "in_progress";
  if (toolId === "idea-development" && ideasCount > 0) return "linked";
  return "not_started";
}
