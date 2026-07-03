import { prisma } from "@/lib/prisma";
import type { ProjectUsageSignals } from "@/lib/project-tool-progress";

const EMPTY_SIGNALS: ProjectUsageSignals = {
  ideaCount: 0,
  scriptCount: 0,
  scriptReviewCount: 0,
  sceneCount: 0,
  breakdownCharacterCount: 0,
  budgetLineCount: 0,
  shootDayCount: 0,
  castingRoleCount: 0,
  crewNeedCount: 0,
  equipmentItemCount: 0,
  contractCount: 0,
  taskCount: 0,
  tableReadCount: 0,
  riskItemCount: 0,
  callSheetCount: 0,
  incidentCount: 0,
  dailiesClipCount: 0,
  contentLinked: false,
};

function bump(map: Map<string, ProjectUsageSignals>, projectId: string, patch: Partial<ProjectUsageSignals>) {
  const cur = map.get(projectId) ?? { ...EMPTY_SIGNALS };
  map.set(projectId, {
    ideaCount: cur.ideaCount + (patch.ideaCount ?? 0),
    scriptCount: cur.scriptCount + (patch.scriptCount ?? 0),
    scriptReviewCount: cur.scriptReviewCount + (patch.scriptReviewCount ?? 0),
    sceneCount: cur.sceneCount + (patch.sceneCount ?? 0),
    breakdownCharacterCount: cur.breakdownCharacterCount + (patch.breakdownCharacterCount ?? 0),
    budgetLineCount: cur.budgetLineCount + (patch.budgetLineCount ?? 0),
    shootDayCount: cur.shootDayCount + (patch.shootDayCount ?? 0),
    castingRoleCount: cur.castingRoleCount + (patch.castingRoleCount ?? 0),
    crewNeedCount: cur.crewNeedCount + (patch.crewNeedCount ?? 0),
    equipmentItemCount: cur.equipmentItemCount + (patch.equipmentItemCount ?? 0),
    contractCount: cur.contractCount + (patch.contractCount ?? 0),
    taskCount: cur.taskCount + (patch.taskCount ?? 0),
    tableReadCount: cur.tableReadCount + (patch.tableReadCount ?? 0),
    riskItemCount: cur.riskItemCount + (patch.riskItemCount ?? 0),
    callSheetCount: cur.callSheetCount + (patch.callSheetCount ?? 0),
    incidentCount: cur.incidentCount + (patch.incidentCount ?? 0),
    dailiesClipCount: cur.dailiesClipCount + (patch.dailiesClipCount ?? 0),
    contentLinked: cur.contentLinked || Boolean(patch.contentLinked),
  });
}

/** Batch-load lightweight usage signals per project for pipeline progress inference. */
export async function loadProjectUsageSignals(
  projectIds: string[],
  ideaCountByProject: Map<string, number>,
): Promise<Map<string, ProjectUsageSignals>> {
  const map = new Map<string, ProjectUsageSignals>();
  if (projectIds.length === 0) return map;

  for (const id of projectIds) {
    map.set(id, { ...EMPTY_SIGNALS, ideaCount: ideaCountByProject.get(id) ?? 0 });
  }

  const whereIn = { projectId: { in: projectIds } };

  const [
    scripts,
    reviews,
    scenes,
    breakdownChars,
    budgets,
    shootDays,
    casting,
    crew,
    equipment,
    contracts,
    tasks,
    tableReads,
    riskPlans,
    callSheets,
    incidents,
    dailies,
    linkedContent,
  ] = await Promise.all([
    prisma.projectScript.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.scriptReviewSession.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.projectScene.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.breakdownCharacter.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.projectBudget.findMany({
      where: { projectId: { in: projectIds } },
      select: { projectId: true, _count: { select: { lines: true } } },
    }),
    prisma.shootDay.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.castingRole.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.crewRoleNeed.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.equipmentPlanItem.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.projectContract.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.projectTask.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.tableReadSession.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.riskPlan.findMany({ where: { projectId: { in: projectIds } }, include: { _count: { select: { items: true } } } }),
    prisma.callSheet.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.incidentReport.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.dailiesClip.groupBy({ by: ["projectId"], where: whereIn, _count: { _all: true } }),
    prisma.content.findMany({
      where: { linkedProjectId: { in: projectIds } },
      select: { linkedProjectId: true },
    }),
  ]);

  for (const row of scripts) bump(map, row.projectId, { scriptCount: row._count._all });
  for (const row of reviews) bump(map, row.projectId, { scriptReviewCount: row._count._all });
  for (const row of scenes) bump(map, row.projectId, { sceneCount: row._count._all });
  for (const row of breakdownChars) bump(map, row.projectId, { breakdownCharacterCount: row._count._all });
  for (const row of budgets) bump(map, row.projectId, { budgetLineCount: row._count.lines });
  for (const row of shootDays) bump(map, row.projectId, { shootDayCount: row._count._all });
  for (const row of casting) bump(map, row.projectId, { castingRoleCount: row._count._all });
  for (const row of crew) bump(map, row.projectId, { crewNeedCount: row._count._all });
  for (const row of equipment) bump(map, row.projectId, { equipmentItemCount: row._count._all });
  for (const row of contracts) bump(map, row.projectId, { contractCount: row._count._all });
  for (const row of tasks) bump(map, row.projectId, { taskCount: row._count._all });
  for (const row of tableReads) bump(map, row.projectId, { tableReadCount: row._count._all });
  for (const plan of riskPlans) bump(map, plan.projectId, { riskItemCount: plan._count.items });
  for (const row of callSheets) bump(map, row.projectId, { callSheetCount: row._count._all });
  for (const row of incidents) bump(map, row.projectId, { incidentCount: row._count._all });
  for (const row of dailies) bump(map, row.projectId, { dailiesClipCount: row._count._all });
  for (const row of linkedContent) {
    if (row.linkedProjectId) bump(map, row.linkedProjectId, { contentLinked: true });
  }

  return map;
}
