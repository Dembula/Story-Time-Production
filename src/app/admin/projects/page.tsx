import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getStoryTimeOriginalBadge } from "@/lib/storytime-original";
import {
  buildPipelineRollup,
  resolveToolProgressForProject,
  type ProjectUsageSignals,
} from "@/lib/project-tool-progress";
import { loadProjectUsageSignals } from "@/lib/project-usage-signals";
import {
  AdminProjectsClient,
  type AdminProjectListItem,
} from "./admin-projects-client";

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

export default async function AdminProjectsPage() {
  await requireAdminSession();

  const [projects, linkGroups, ideaCounts] = await Promise.all([
    prisma.originalProject.findMany({
      include: {
        pitches: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            creator: {
              select: { id: true, name: true, email: true, networkHandle: true },
            },
          },
        },
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, networkHandle: true } },
          },
        },
        toolProgress: {
          select: { toolId: true, status: true, phase: true, percent: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.content.groupBy({
      by: ["linkedProjectId"],
      where: { linkedProjectId: { not: null } },
      _count: { _all: true },
    }),
    prisma.projectIdea.groupBy({
      by: ["projectId"],
      where: { projectId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const linkedCatalogueCount: Record<string, number> = {};
  for (const g of linkGroups) {
    if (g.linkedProjectId) linkedCatalogueCount[g.linkedProjectId] = g._count._all;
  }

  const ideaCountByProject = new Map<string, number>();
  for (const row of ideaCounts) {
    if (row.projectId) ideaCountByProject.set(row.projectId, row._count._all);
  }

  const projectIds = projects.map((p) => p.id);
  const signalsByProject = await loadProjectUsageSignals(projectIds, ideaCountByProject);

  const listItems: AdminProjectListItem[] = projects.map((project) => {
    const latestPitch = project.pitches[0];
    const originalBadge = getStoryTimeOriginalBadge(latestPitch);
    const signals = signalsByProject.get(project.id) ?? {
      ...EMPTY_SIGNALS,
      ideaCount: ideaCountByProject.get(project.id) ?? 0,
      contentLinked: (linkedCatalogueCount[project.id] ?? 0) > 0,
    };

    const resolved = resolveToolProgressForProject({
      projectStatus: project.status,
      stored: project.toolProgress.map((t) => ({
        toolId: t.toolId,
        phase: t.phase,
        status: t.status,
        percent: t.percent,
      })),
      signals,
      hubToolsOnly: true,
    });
    const rollup = buildPipelineRollup(resolved, project.status);

    const activeMemberCount = project.members.filter((m) =>
      ["ACTIVE", "ACCEPTED"].includes(m.status),
    ).length;
    const invitedMemberCount = project.members.filter((m) => m.status === "INVITED").length;

    const memberPreview = project.members
      .filter((m) => ["ACTIVE", "ACCEPTED", "INVITED"].includes(m.status))
      .map((m) => m.user.name || m.user.networkHandle || m.user.email || "Member")
      .slice(0, 4);

    return {
      id: project.id,
      title: project.title,
      logline: project.logline,
      type: project.type,
      genre: project.genre,
      status: project.status,
      phase: project.phase,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      toolsComplete: rollup.completeCount,
      toolsTracked: rollup.totalTracked,
      toolsInProgress: rollup.inProgressCount,
      toolsSkipped: rollup.skippedCount,
      progressPercent: rollup.progressPercent,
      linkedCatalogueCount: linkedCatalogueCount[project.id] ?? 0,
      memberCount: project.members.length,
      activeMemberCount,
      invitedMemberCount,
      memberPreview,
      leadCreator: latestPitch?.creator
        ? {
            id: latestPitch.creator.id,
            name: latestPitch.creator.name,
            email: latestPitch.creator.email,
            networkHandle: latestPitch.creator.networkHandle,
          }
        : project.members[0]?.user
          ? {
              id: project.members[0].user.id,
              name: project.members[0].user.name,
              email: project.members[0].user.email,
              networkHandle: project.members[0].user.networkHandle,
            }
          : null,
      originalTone:
        originalBadge.tone === "greenlit" || originalBadge.tone === "pending"
          ? originalBadge.tone
          : null,
    };
  });

  return (
    <div className="space-y-6 px-2 md:px-0">
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">
          Operations
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Projects &amp; pipeline
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Expand any project for a full dossier: creators, team, pipeline tools, scripts, casting,
          budgets, catalogue links, and production activity.
        </p>
      </header>

      <AdminProjectsClient projects={listItems} />
    </div>
  );
}
