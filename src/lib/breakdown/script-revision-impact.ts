import { diffContractTerms, summarizeContractDiff } from "@/lib/legal/contract-version-diff";
import { parseScenesFromScreenplay } from "@/lib/scene-parser";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify-user";
import { CATEGORY_TO_DEPARTMENT } from "@/lib/breakdown/departments";
import type { BreakdownCategoryKey, BreakdownDepartmentId } from "@/lib/breakdown/types";

export type ScriptRevisionImpact = {
  previousVersionId: string | null;
  currentVersionId: string | null;
  summary: { added: number; removed: number; changed: number; total: number };
  scenesAdded: string[];
  scenesRemoved: string[];
  scenesChanged: string[];
  affectedDepartments: BreakdownDepartmentId[];
  departmentNotes: Array<{ departmentId: BreakdownDepartmentId; message: string }>;
  diffPreview: Array<{ lineNumber: number; kind: string; textA: string | null; textB: string | null }>;
};

function sceneHeadings(content: string): string[] {
  return parseScenesFromScreenplay(content).map((s) => s.heading.trim().toUpperCase());
}

function departmentsForSceneNumbers(
  projectId: string,
  sceneNumbers: string[],
  scenes: Array<{ id: string; number: string }>,
): Promise<BreakdownDepartmentId[]> {
  const ids = sceneNumbers
    .map((n) => scenes.find((s) => s.number === n)?.id)
    .filter(Boolean) as string[];
  if (ids.length === 0) return Promise.resolve([]);

  return prisma.projectScene
    .findMany({
      where: { projectId, id: { in: ids } },
      include: {
        breakdownCharacters: { select: { id: true } },
        breakdownProps: { select: { id: true } },
        breakdownLocations: { select: { id: true } },
        breakdownWardrobes: { select: { id: true } },
        breakdownExtras: { select: { id: true } },
        breakdownVehicles: { select: { id: true } },
        breakdownStunts: { select: { id: true } },
        breakdownSfxs: { select: { id: true } },
        breakdownMakeups: { select: { id: true } },
      },
    })
    .then((rows) => {
      const depts = new Set<BreakdownDepartmentId>();
      for (const row of rows) {
        if (row.breakdownCharacters.length) depts.add(CATEGORY_TO_DEPARTMENT.characters);
        if (row.breakdownProps.length) depts.add(CATEGORY_TO_DEPARTMENT.props);
        if (row.breakdownLocations.length) depts.add(CATEGORY_TO_DEPARTMENT.locations);
        if (row.breakdownWardrobes.length) depts.add(CATEGORY_TO_DEPARTMENT.wardrobe);
        if (row.breakdownExtras.length) depts.add(CATEGORY_TO_DEPARTMENT.extras);
        if (row.breakdownVehicles.length) depts.add(CATEGORY_TO_DEPARTMENT.vehicles);
        if (row.breakdownStunts.length) depts.add(CATEGORY_TO_DEPARTMENT.stunts);
        if (row.breakdownSfxs.length) depts.add(CATEGORY_TO_DEPARTMENT.sfx);
        if (row.breakdownMakeups.length) depts.add(CATEGORY_TO_DEPARTMENT.makeups);
      }
      return [...depts];
    });
}

export async function analyzeScriptRevisionImpact(
  projectId: string,
  previousContent: string,
  currentContent: string,
): Promise<ScriptRevisionImpact> {
  const diff = diffContractTerms(previousContent, currentContent);
  const summary = summarizeContractDiff(diff);

  const prevHeadings = sceneHeadings(previousContent);
  const currHeadings = sceneHeadings(currentContent);
  const prevSet = new Set(prevHeadings);
  const currSet = new Set(currHeadings);

  const scenesAdded = currHeadings.filter((h) => !prevSet.has(h));
  const scenesRemoved = prevHeadings.filter((h) => !currSet.has(h));

  const changedLines = diff.filter((d) => d.kind === "changed" || d.kind === "added" || d.kind === "removed");
  const scenesChanged =
    changedLines.length > 0 && currHeadings.length > 0
      ? currHeadings.slice(0, Math.min(5, currHeadings.length))
      : [];

  const scenes = await prisma.projectScene.findMany({
    where: { projectId },
    select: { id: true, number: true },
    orderBy: { number: "asc" },
  });

  const addedNums = parseScenesFromScreenplay(currentContent)
    .filter((s) => scenesAdded.includes(s.heading.trim().toUpperCase()))
    .map((s) => s.number);
  const removedNums = parseScenesFromScreenplay(previousContent)
    .filter((s) => scenesRemoved.includes(s.heading.trim().toUpperCase()))
    .map((s) => s.number);

  const affectedFromScenes = await departmentsForSceneNumbers(projectId, [...addedNums, ...removedNums], scenes);

  const departmentNotes: ScriptRevisionImpact["departmentNotes"] = [];
  if (scenesAdded.length > 0) {
    departmentNotes.push({
      departmentId: "locations",
      message: `${scenesAdded.length} new scene slugline(s) — review locations and scheduling.`,
    });
  }
  if (scenesRemoved.length > 0) {
    departmentNotes.push({
      departmentId: "cast",
      message: `${scenesRemoved.length} scene(s) removed — verify cast day-out-of-days and budget.`,
    });
  }
  if (summary.changed > 0) {
    departmentNotes.push({
      departmentId: "props",
      message: `${summary.changed} line(s) changed — props, wardrobe, and continuity may need updates.`,
    });
  }

  const affectedDepartments = [...new Set([...affectedFromScenes, ...departmentNotes.map((d) => d.departmentId)])];

  return {
    previousVersionId: null,
    currentVersionId: null,
    summary,
    scenesAdded,
    scenesRemoved,
    scenesChanged,
    affectedDepartments,
    departmentNotes,
    diffPreview: diff.filter((d) => d.kind !== "same").slice(0, 80),
  };
}

export async function notifyBreakdownRevisionImpact(params: {
  projectId: string;
  userId: string;
  scriptTitle: string;
  impact: ScriptRevisionImpact;
}): Promise<void> {
  const { impact } = params;
  if (impact.summary.added === 0 && impact.summary.removed === 0 && impact.summary.changed === 0) return;

  const project = await prisma.originalProject.findUnique({
    where: { id: params.projectId },
    include: { members: { select: { userId: true } } },
  });
  if (!project) return;

  const recipientIds = new Set<string>([params.userId, ...project.members.map((m) => m.userId)]);

  const bodyParts = [
    impact.scenesAdded.length ? `${impact.scenesAdded.length} scene(s) added` : null,
    impact.scenesRemoved.length ? `${impact.scenesRemoved.length} scene(s) removed` : null,
    impact.summary.changed ? `${impact.summary.changed} line(s) changed` : null,
  ].filter(Boolean);

  const deptList = impact.affectedDepartments.slice(0, 4).join(", ");

  for (const uid of recipientIds) {
    await notifyUser({
      userId: uid,
      type: "BREAKDOWN_REVISION",
      title: `Script revision — ${params.scriptTitle}`,
      body: `${bodyParts.join(" · ")}. Departments to review: ${deptList || "all"}.`,
      metadata: {
        projectId: params.projectId,
        url: `/creator/projects/${params.projectId}/pre-production/script-breakdown?tab=revisions`,
        affectedDepartments: impact.affectedDepartments,
        scenesAdded: impact.scenesAdded.length,
        scenesRemoved: impact.scenesRemoved.length,
        linesChanged: impact.summary.changed,
      },
    });
  }
}

export async function loadLatestScriptRevisionImpact(projectId: string): Promise<ScriptRevisionImpact | null> {
  const script = await prisma.projectScript.findFirst({
    where: { projectId },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 2 },
    },
  });
  if (!script || script.versions.length < 2) return null;

  const [current, previous] = script.versions;
  const impact = await analyzeScriptRevisionImpact(projectId, previous.content, current.content);
  return {
    ...impact,
    previousVersionId: previous.id,
    currentVersionId: current.id,
  };
}
