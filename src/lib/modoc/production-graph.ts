import "server-only";

import { prisma } from "@/lib/prisma";

export type GraphNodeType =
  | "project"
  | "script"
  | "scene"
  | "character"
  | "location"
  | "budget_line"
  | "shoot_day"
  | "task"
  | "asset"
  | "contract"
  | "risk_item";

export type GraphEdgeType =
  | "depends_on"
  | "derived_from"
  | "scheduled_in"
  | "allocated_to"
  | "references"
  | "conflicts_with";

export type ProductionGraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type ProductionGraphEdge = {
  from: string;
  to: string;
  type: GraphEdgeType;
};

export type ReadinessSignal = {
  id: string;
  label: string;
  satisfied: boolean;
  confidence: number;
  suggestedAction?: string;
  blockedBy?: string[];
};

export type ProductionGraph = {
  projectId: string;
  projectTitle: string;
  phase: string;
  status: string;
  nodes: ProductionGraphNode[];
  edges: ProductionGraphEdge[];
  readiness: ReadinessSignal[];
  missingContextFlags: string[];
  stats: {
    sceneCount: number;
    characterCount: number;
    budgetLineCount: number;
    shootDayCount: number;
    openTaskCount: number;
    contractCount: number;
    signedContractCount: number;
    hasScript: boolean;
  };
};

const DESTRUCTIVE_ACTIONS = new Set([
  "delete_project_idea",
  "delete_budget_line",
  "delete_shoot_day",
  "delete_casting_role",
  "delete_crew_need",
  "delete_breakdown_location",
  "delete_equipment_plan_item",
  "delete_production_expense",
  "delete_incident_report",
  "delete_continuity_note",
  "delete_dailies_batch",
  "delete_table_read_session",
  "delete_music_selection",
  "delete_footage_asset",
  "delete_visual_asset",
  "delete_contract",
  "delete_post_review",
  "delete_calendar_event",
  "delete_project_task",
  "delete_risk_checklist_item",
]);

export function isDestructiveModocAction(action: string): boolean {
  return DESTRUCTIVE_ACTIONS.has(action);
}

/** Build structured production graph for a project — state truth for MODOC reasoning. */
export async function buildProductionGraph(
  userId: string,
  projectId: string,
): Promise<ProductionGraph | null> {
  const project = await prisma.originalProject.findFirst({
    where: {
      id: projectId,
      OR: [
        { pitches: { some: { creatorId: userId } } },
        { members: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      title: true,
      phase: true,
      status: true,
    },
  });
  if (!project) return null;

  const [
    script,
    scenes,
    characters,
    locations,
    budget,
    shootDays,
    tasks,
    contracts,
    risks,
    footageCount,
  ] = await Promise.all([
    prisma.projectScript.findFirst({
      where: { projectId },
      include: { versions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
    }),
    prisma.projectScene.findMany({
      where: { projectId },
      select: { id: true, number: true, heading: true },
      take: 50,
      orderBy: { number: "asc" },
    }),
    prisma.breakdownCharacter.findMany({
      where: { projectId },
      select: { id: true, name: true, sceneId: true },
      take: 40,
    }),
    prisma.breakdownLocation.findMany({
      where: { projectId },
      select: { id: true, name: true, sceneId: true },
      take: 30,
    }),
    prisma.projectBudget.findUnique({
      where: { projectId },
      include: { lines: { select: { id: true, name: true, department: true }, take: 30 } },
    }),
    prisma.shootDay.findMany({
      where: { projectId },
      select: { id: true, date: true, unit: true },
      take: 20,
      orderBy: { date: "asc" },
    }),
    prisma.projectTask.findMany({
      where: { projectId, status: "TODO" },
      select: { id: true, title: true, dueDate: true },
      take: 20,
    }),
    prisma.projectContract.findMany({
      where: { projectId },
      select: { id: true, subject: true, status: true },
      take: 15,
    }),
    prisma.riskChecklistItem.findMany({
      where: { plan: { projectId } },
      select: { id: true, description: true, status: true },
      take: 15,
    }),
    prisma.footageAsset.count({ where: { projectId } }),
  ]);

  const nodes: ProductionGraphNode[] = [
    {
      id: project.id,
      type: "project",
      label: project.title,
      meta: { phase: project.phase, status: project.status },
    },
  ];
  const edges: ProductionGraphEdge[] = [];
  const missingContextFlags: string[] = [];

  const hasScript = Boolean(script?.versions[0]?.id);
  if (script) {
    nodes.push({ id: script.id, type: "script", label: script.title });
    edges.push({ from: project.id, to: script.id, type: "references" });
  } else {
    missingContextFlags.push("no_script");
  }

  for (const scene of scenes) {
    nodes.push({
      id: scene.id,
      type: "scene",
      label: `Scene ${scene.number}${scene.heading ? `: ${scene.heading}` : ""}`,
    });
    if (script) edges.push({ from: scene.id, to: script.id, type: "derived_from" });
  }

  for (const ch of characters) {
    nodes.push({ id: ch.id, type: "character", label: ch.name });
    if (ch.sceneId) edges.push({ from: ch.id, to: ch.sceneId, type: "allocated_to" });
    else edges.push({ from: ch.id, to: project.id, type: "references" });
  }

  for (const loc of locations) {
    nodes.push({ id: loc.id, type: "location", label: loc.name });
    if (loc.sceneId) edges.push({ from: loc.id, to: loc.sceneId, type: "allocated_to" });
  }

  const budgetLineCount = budget?.lines.length ?? 0;
  if (budget) {
    for (const line of budget.lines) {
      nodes.push({
        id: line.id,
        type: "budget_line",
        label: line.name,
        meta: { department: line.department ?? null },
      });
      edges.push({ from: line.id, to: project.id, type: "allocated_to" });
    }
  } else {
    missingContextFlags.push("no_budget");
  }

  for (const day of shootDays) {
    nodes.push({
      id: day.id,
      type: "shoot_day",
      label: day.date ? day.date.toISOString().slice(0, 10) : "Unscheduled day",
      meta: { unit: day.unit ?? null },
    });
    edges.push({ from: day.id, to: project.id, type: "scheduled_in" });
  }

  for (const task of tasks) {
    nodes.push({ id: task.id, type: "task", label: task.title });
    edges.push({ from: task.id, to: project.id, type: "depends_on" });
  }

  for (const c of contracts) {
    nodes.push({
      id: c.id,
      type: "contract",
      label: c.subject ?? "Contract",
      meta: { status: c.status },
    });
    edges.push({ from: c.id, to: project.id, type: "references" });
  }

  for (const r of risks) {
    nodes.push({ id: r.id, type: "risk_item", label: r.description.slice(0, 80) });
    edges.push({ from: r.id, to: project.id, type: "depends_on" });
  }

  if (footageCount > 0) {
    nodes.push({
      id: `footage-aggregate-${projectId}`,
      type: "asset",
      label: `${footageCount} footage asset(s)`,
    });
  }

  const signedContracts = contracts.filter((c) =>
    ["SIGNED", "ACCEPTED"].includes(c.status.toUpperCase()),
  ).length;

  const stats = {
    sceneCount: scenes.length,
    characterCount: characters.length,
    budgetLineCount,
    shootDayCount: shootDays.length,
    openTaskCount: tasks.length,
    contractCount: contracts.length,
    signedContractCount: signedContracts,
    hasScript,
  };

  const readiness = buildReadinessSignals(stats, missingContextFlags);

  return {
    projectId: project.id,
    projectTitle: project.title,
    phase: project.phase,
    status: project.status,
    nodes,
    edges,
    readiness,
    missingContextFlags,
    stats,
  };
}

function buildReadinessSignals(
  stats: ProductionGraph["stats"],
  missing: string[],
): ReadinessSignal[] {
  const signals: ReadinessSignal[] = [];

  signals.push({
    id: "script_ready",
    label: "Screenplay on file",
    satisfied: stats.hasScript,
    confidence: stats.hasScript ? 1 : 0,
    suggestedAction: stats.hasScript ? undefined : "update_script_content",
    blockedBy: stats.hasScript ? undefined : ["no_script"],
  });

  signals.push({
    id: "scenes_synced",
    label: "Scenes extracted from script",
    satisfied: stats.sceneCount > 0,
    confidence: stats.hasScript && stats.sceneCount === 0 ? 0.9 : stats.sceneCount > 0 ? 1 : 0,
    suggestedAction: stats.hasScript && stats.sceneCount === 0 ? "sync_scenes_from_script" : undefined,
    blockedBy: !stats.hasScript ? ["no_script"] : stats.sceneCount === 0 ? ["no_scenes"] : undefined,
  });

  signals.push({
    id: "breakdown_ready",
    label: "Breakdown populated",
    satisfied: stats.characterCount > 0,
    confidence:
      stats.sceneCount > 0 && stats.characterCount === 0
        ? 0.88
        : stats.characterCount > 0
          ? 1
          : 0,
    suggestedAction:
      stats.sceneCount > 0 && stats.characterCount === 0 ? "breakdown_full" : undefined,
    blockedBy:
      stats.sceneCount === 0
        ? ["no_scenes"]
        : stats.characterCount === 0
          ? ["no_breakdown"]
          : undefined,
  });

  signals.push({
    id: "budget_ready",
    label: "Budget lines exist",
    satisfied: stats.budgetLineCount > 0,
    confidence:
      stats.characterCount > 0 && stats.budgetLineCount === 0 ? 0.85 : stats.budgetLineCount > 0 ? 1 : 0,
    suggestedAction:
      stats.characterCount > 0 && stats.budgetLineCount === 0
        ? "generate_smart_budget"
        : undefined,
    blockedBy: stats.characterCount === 0 ? ["no_breakdown"] : missing.includes("no_budget") ? ["no_budget"] : undefined,
  });

  signals.push({
    id: "schedule_ready",
    label: "Shoot days scheduled",
    satisfied: stats.shootDayCount > 0,
    confidence: stats.budgetLineCount > 0 && stats.shootDayCount === 0 ? 0.8 : stats.shootDayCount > 0 ? 1 : 0,
    suggestedAction:
      stats.budgetLineCount > 0 && stats.shootDayCount === 0 ? "auto_schedule_shoot_days" : undefined,
  });

  signals.push({
    id: "production_tasks",
    label: "Open production tasks tracked",
    satisfied: stats.openTaskCount > 0 || stats.shootDayCount > 0,
    confidence: 0.7,
    suggestedAction: stats.shootDayCount > 0 && stats.openTaskCount === 0 ? "create_starter_tasks" : undefined,
  });

  return signals;
}

export function formatProductionGraphForPrompt(graph: ProductionGraph): string {
  const topReadiness = graph.readiness
    .filter((r) => !r.satisfied && r.confidence >= 0.75)
    .map((r) => `- ${r.label} (confidence ${Math.round(r.confidence * 100)}%) → ${r.suggestedAction ?? "review"}`)
    .join("\n");

  return `### Production graph (structured state — source of truth)
\`\`\`json
${JSON.stringify(
  {
    projectId: graph.projectId,
    title: graph.projectTitle,
    phase: graph.phase,
    status: graph.status,
    stats: graph.stats,
    missingContextFlags: graph.missingContextFlags,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    nodes: graph.nodes.slice(0, 80),
    edges: graph.edges.slice(0, 100),
    readiness: graph.readiness,
  },
  null,
  2,
)}
\`\`\`

**High-confidence next steps (proactive threshold ≥ 0.75):**
${topReadiness || "(none — pipeline step satisfied or blocked)"}`;
}
