import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseEmbeddedMeta } from "@/lib/marketplace-profile-meta";

type ChecklistItem = {
  key:
    | "shootCompletion"
    | "taskCompletion"
    | "incidentResolution"
    | "equipmentReturn"
    | "expenseFinalization"
    | "continuityData"
    | "contracts";
  label: string;
  pass: boolean;
  detail: string;
  blocking: boolean;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function sceneStatusFromBoard(entry: Record<string, unknown> | undefined): string {
  const status = `${entry?.manualStatus ?? entry?.status ?? "NOT_STARTED"}`.toUpperCase();
  if (status === "DONE") return "COMPLETED";
  return status;
}

async function ensureAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null as string | null };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });
  if (!project) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null as string | null };

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);
  if (!isCreatorMember) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null as string | null };

  return { error: null as NextResponse | null, userId, project };
}

async function buildWrapState(projectId: string) {
  const [
    project,
    shootDays,
    boards,
    tasks,
    incidents,
    equipment,
    expenses,
    scenes,
    continuity,
    contracts,
    castRoles,
    crewNeeds,
    submissions,
  ] = await Promise.all([
    prisma.originalProject.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, synopsis: true, status: true, phase: true },
    }),
    prisma.shootDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
      include: { scenes: { include: { scene: { select: { id: true, number: true } } } } },
    }),
    prisma.shootDayControlBoard.findMany({
      where: { projectId },
      select: { shootDayId: true, sceneProgress: true },
    }),
    prisma.projectTask.findMany({
      where: { projectId },
      select: { id: true, status: true, priority: true, title: true },
    }),
    prisma.incidentReport.findMany({
      where: { projectId },
      select: { id: true, severity: true, resolved: true, title: true },
    }),
    prisma.equipmentPlanItem.findMany({
      where: { projectId },
      select: { id: true, category: true, quantity: true, notes: true },
    }),
    prisma.productionExpense.findMany({
      where: { projectId },
      select: { id: true, amount: true, department: true, description: true },
    }),
    prisma.projectScene.findMany({
      where: { projectId },
      select: { id: true, number: true, heading: true },
    }),
    prisma.continuityNote.findMany({
      where: { projectId },
      select: { id: true, sceneId: true },
    }),
    prisma.projectContract.findMany({
      where: { projectId },
      select: { id: true, status: true, subject: true, type: true },
    }),
    prisma.castingRole.findMany({
      where: { projectId },
      select: { id: true, name: true, status: true },
    }),
    prisma.crewRoleNeed.findMany({
      where: { projectId },
      select: { id: true, role: true, department: true },
    }),
    prisma.distributionSubmission.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { id: true, status: true },
    }),
  ]);

  const boardByDay = new Map(boards.map((b) => [b.shootDayId, asRecord(b.sceneProgress)]));
  const sceneRows = shootDays.flatMap((day) => {
    const progress = boardByDay.get(day.id) ?? {};
    return day.scenes.map((link) => {
      const entry = asRecord(progress[link.id]);
      const status = sceneStatusFromBoard(entry);
      return {
        shootDayId: day.id,
        sceneId: link.sceneId,
        sceneNumber: link.scene?.number ?? "?",
        status,
      };
    });
  });
  const completedScenes = sceneRows.filter((s) => s.status === "COMPLETED").length;
  const unfinishedOrDelayed = sceneRows.filter((s) => s.status !== "COMPLETED");

  const criticalTasks = tasks.filter((t) => ["HIGH", "CRITICAL"].includes(`${t.priority ?? ""}`.toUpperCase()));
  const incompleteCriticalTasks = criticalTasks.filter(
    (t) => !["DONE", "COMPLETED", "CLOSED"].includes(`${t.status ?? ""}`.toUpperCase()),
  );

  const blockingIncidents = incidents.filter(
    (i) => ["HIGH", "CRITICAL"].includes(`${i.severity ?? ""}`.toUpperCase()) && !i.resolved,
  );

  const notReturnedEquipment = equipment.filter((e) => {
    const status = `${parseEmbeddedMeta<{ currentStatus?: string }>(e.notes).meta?.currentStatus ?? "PLANNED"}`.toUpperCase();
    return status !== "RETURNED";
  });

  const uncategorizedExpenses = expenses.filter((e) => {
    const parsed = parseEmbeddedMeta<{ category?: string }>(e.description).meta;
    const category = parsed?.category ?? e.department;
    return !category || Number(e.amount ?? 0) <= 0;
  });

  const continuityByScene = new Set(continuity.map((n) => n.sceneId).filter(Boolean));
  const scenesMissingContinuity = scenes.filter((s) => !continuityByScene.has(s.id));

  const unsignedContracts = contracts.filter((c) => !["SIGNED", "EXECUTED", "CLOSED", "COMPLETED"].includes(c.status));

  const checklist: ChecklistItem[] = [
    {
      key: "shootCompletion",
      label: "Shoot completion",
      pass: sceneRows.length > 0 && unfinishedOrDelayed.length === 0,
      detail:
        sceneRows.length === 0
          ? "No scene progress records found."
          : unfinishedOrDelayed.length === 0
            ? `All ${sceneRows.length} scheduled scene entries are marked completed.`
            : `${unfinishedOrDelayed.length} scene entries are unfinished or delayed.`,
      blocking: true,
    },
    {
      key: "taskCompletion",
      label: "Critical tasks",
      pass: incompleteCriticalTasks.length === 0,
      detail:
        criticalTasks.length === 0
          ? "No high/critical tasks found."
          : incompleteCriticalTasks.length === 0
            ? `All ${criticalTasks.length} high/critical tasks are complete.`
            : `${incompleteCriticalTasks.length} high/critical tasks remain open.`,
      blocking: true,
    },
    {
      key: "incidentResolution",
      label: "Incident resolution",
      pass: blockingIncidents.length === 0,
      detail:
        blockingIncidents.length === 0
          ? "No unresolved high/critical incidents."
          : `${blockingIncidents.length} high/critical incidents unresolved.`,
      blocking: true,
    },
    {
      key: "equipmentReturn",
      label: "Equipment return",
      pass: notReturnedEquipment.length === 0,
      detail:
        notReturnedEquipment.length === 0
          ? "All equipment items are marked returned."
          : `${notReturnedEquipment.length} equipment items not marked returned.`,
      blocking: true,
    },
    {
      key: "expenseFinalization",
      label: "Expense finalization",
      pass: expenses.length > 0 && uncategorizedExpenses.length === 0,
      detail:
        expenses.length === 0
          ? "No expenses recorded yet."
          : uncategorizedExpenses.length === 0
            ? `${expenses.length} expenses logged and categorized.`
            : `${uncategorizedExpenses.length} expenses missing category or amount.`,
      blocking: true,
    },
    {
      key: "continuityData",
      label: "Continuity coverage",
      pass: scenes.length > 0 && scenesMissingContinuity.length === 0,
      detail:
        scenes.length === 0
          ? "No scenes found."
          : scenesMissingContinuity.length === 0
            ? `Continuity records available for all ${scenes.length} scenes.`
            : `${scenesMissingContinuity.length} scenes have no continuity record.`,
      blocking: true,
    },
    {
      key: "contracts",
      label: "Contracts",
      pass: unsignedContracts.length === 0,
      detail:
        contracts.length === 0
          ? "No contracts linked."
          : unsignedContracts.length === 0
            ? `All ${contracts.length} contracts are signed/completed.`
            : `${unsignedContracts.length} contracts are not fully signed/completed.`,
      blocking: true,
    },
  ];

  const totalBudget = (
    await prisma.projectBudget.findUnique({
      where: { projectId },
      select: { totalPlanned: true },
    })
  )?.totalPlanned ?? 0;
  const totalSpend = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const signedContracts = contracts.filter((c) => ["SIGNED", "EXECUTED", "CLOSED", "COMPLETED"].includes(c.status)).length;
  const returnedUnits = equipment.reduce((sum, e) => {
    const status = `${parseEmbeddedMeta<{ currentStatus?: string }>(e.notes).meta?.currentStatus ?? ""}`.toUpperCase();
    return sum + (status === "RETURNED" ? e.quantity : 0);
  }, 0);
  const totalEquipmentUnits = equipment.reduce((sum, e) => sum + e.quantity, 0);
  const completedTasks = tasks.filter((t) => ["DONE", "COMPLETED", "CLOSED"].includes(`${t.status ?? ""}`.toUpperCase())).length;

  return {
    project,
    checklist,
    summary: {
      totalShootDays: shootDays.length,
      totalSceneEntries: sceneRows.length,
      scenesCompleted: completedScenes,
      budgetPlanned: totalBudget,
      budgetActual: totalSpend,
      incidentCount: incidents.length,
      unresolvedHighCriticalIncidents: blockingIncidents.length,
      equipmentUnitsReturned: returnedUnits,
      equipmentUnitsTotal: totalEquipmentUnits,
      tasksCompleted: completedTasks,
      tasksTotal: tasks.length,
      contractsSigned: signedContracts,
      contractsTotal: contracts.length,
      castCount: castRoles.length,
      crewNeedsCount: crewNeeds.length,
    },
    canMoveToPost: checklist.every((item) => item.pass || !item.blocking),
    failures: checklist.filter((item) => !item.pass && item.blocking),
    latestDistributionDraft: submissions[0] ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const state = await buildWrapState(projectId);
  return NextResponse.json(state);
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const state = await buildWrapState(projectId);
  if (!state.canMoveToPost) {
    return NextResponse.json(
      {
        error: "Wrap validation failed",
        checklist: state.checklist,
        failures: state.failures,
      },
      { status: 400 },
    );
  }

  const userId = access.userId!;
  const txResult = await prisma.$transaction(async (tx) => {
    const before = await tx.originalProject.findUnique({
      where: { id: projectId },
      select: { status: true, phase: true, title: true, synopsis: true },
    });
    if (!before) throw new Error("Project not found");

    const updatedProject = await tx.originalProject.update({
      where: { id: projectId },
      data: {
        status: "POST_PRODUCTION",
        phase: "EDITING",
      },
      select: { id: true, status: true, phase: true, title: true, synopsis: true },
    });

    const credits = await tx.originalMember.findMany({
      where: { projectId },
      select: { role: true, department: true, user: { select: { name: true, email: true } } },
    });

    const distributionDraft = await tx.distributionSubmission.create({
      data: {
        projectId,
        target: "STORY_TIME",
        status: "DRAFT",
        note: JSON.stringify({
          source: "PRODUCTION_WRAP",
          title: updatedProject.title,
          description: updatedProject.synopsis ?? null,
          productionSummary: state.summary,
          credits: credits.map((c) => ({
            name: c.user?.name ?? c.user?.email ?? "Unknown",
            role: c.role,
            department: c.department,
          })),
          metadataPrefill: {
            title: updatedProject.title,
            description: updatedProject.synopsis ?? "",
            runtime: null,
            language: "English",
            genre: null,
          },
          assetsChecklist: {
            finalFilmUpload: false,
            posterUpload: false,
            trailerUpload: false,
            thumbnailsUpload: false,
          },
          audit: {
            wrappedByUserId: userId,
            wrappedAt: new Date().toISOString(),
          },
        }),
      },
      select: { id: true, status: true, target: true },
    });

    await tx.projectActivity.createMany({
      data: [
        {
          projectId,
          userId,
          type: "PRODUCTION_WRAP_COMPLETED",
          message: "Production wrap completed. Project moved to Post-Production.",
          metadata: JSON.stringify({
            fromStatus: before.status,
            fromPhase: before.phase,
            toStatus: "POST_PRODUCTION",
            toPhase: "EDITING",
            locks: {
              schedule: true,
              tasks: true,
              budget: true,
              equipmentLogs: true,
            },
            summary: state.summary,
          }),
        },
        {
          projectId,
          userId,
          type: "DISTRIBUTION_DRAFT_CREATED",
          message: "Distribution draft auto-created from production wrap.",
          metadata: JSON.stringify({
            distributionSubmissionId: distributionDraft.id,
            status: distributionDraft.status,
            target: distributionDraft.target,
          }),
        },
      ],
    });

    return { updatedProject, distributionDraft };
  });

  return NextResponse.json({
    ok: true,
    project: txResult.updatedProject,
    distributionDraft: txResult.distributionDraft,
    redirectUrl: `/creator/projects/${projectId}/post-production/distribution?draft=${encodeURIComponent(
      txResult.distributionDraft.id,
    )}`,
  });
}

