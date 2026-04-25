import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRiskItemDescription, parseRiskPlanSummary } from "@/lib/risk-insurance-db";

async function ensureReadinessAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId, project };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureReadinessAccess(projectId);
  if (access.error) return access.error;

  const [
    budget,
    castRoles,
    crewNeeds,
    locations,
    equipmentPlan,
    riskPlan,
    contracts,
    sceneCount,
    breakdownCharacterCount,
    charactersWithScene,
    shootDays,
    callSheets,
    unsignedContracts,
    openRiskItems,
  ] = await Promise.all([
    prisma.projectBudget.findUnique({ where: { projectId } }),
    prisma.castingRole.count({ where: { projectId } }),
    prisma.crewRoleNeed.count({ where: { projectId } }),
    prisma.breakdownLocation.count({ where: { projectId } }),
    prisma.equipmentPlanItem.count({ where: { projectId } }),
    prisma.riskPlan.findUnique({ where: { projectId } }),
    prisma.projectContract.count({ where: { projectId } }),
    prisma.projectScene.count({ where: { projectId } }),
    prisma.breakdownCharacter.count({ where: { projectId } }),
    prisma.breakdownCharacter.count({ where: { projectId, sceneId: { not: null } } }),
    prisma.shootDay.findMany({ where: { projectId }, select: { id: true } }),
    prisma.callSheet.findMany({ where: { projectId }, select: { shootDayId: true } }),
    prisma.projectContract.count({
      where: { projectId, NOT: { status: { in: ["SIGNED", "EXECUTED", "CLOSED"] } } },
    }),
    prisma.riskChecklistItem.count({
      where: {
        plan: { projectId },
        NOT: { status: "DONE" },
      },
    }),
  ]);

  const parsedRiskPlan = parseRiskPlanSummary(riskPlan?.summary ?? null);
  const riskItems = riskPlan
    ? await prisma.riskChecklistItem.findMany({
        where: { planId: riskPlan.id },
        select: { id: true, category: true, status: true, description: true },
      })
    : [];
  const structuredRiskItems = riskItems.map((item) => {
    const parsed = parseRiskItemDescription(item.description);
    return {
      ...item,
      severity: parsed.meta.severity ?? "MEDIUM",
      mitigationPlan: parsed.meta.mitigationPlan ?? null,
      linkedPolicyIds: parsed.meta.linkedPolicyIds ?? [],
    };
  });
  const unresolvedHighRiskCount = structuredRiskItems.filter(
    (item) => item.status !== "DONE" && item.severity === "HIGH",
  ).length;
  const unresolvedWithoutInsurance = structuredRiskItems.filter(
    (item) => item.status !== "DONE" && (item.linkedPolicyIds?.length ?? 0) === 0,
  ).length;
  const unresolvedLegalRiskCount = structuredRiskItems.filter(
    (item) => item.status !== "DONE" && item.category === "LEGAL",
  ).length;
  const incompleteChecklistCount = (parsedRiskPlan.meta.checklists ?? []).filter((item) => !item.checked).length;
  const riskGateBlocking =
    unresolvedHighRiskCount > 0 ||
    unresolvedWithoutInsurance > 0 ||
    unresolvedLegalRiskCount > 0 ||
    incompleteChecklistCount > 0;

  const coveredDays = new Set(callSheets.map((c) => c.shootDayId));
  const daysWithoutCallSheet = shootDays.filter((d) => !coveredDays.has(d.id)).length;
  const breakdownSceneCoveragePercent =
    breakdownCharacterCount === 0
      ? null
      : Math.round((charactersWithScene / breakdownCharacterCount) * 100);

  const checklist = {
    hasBudget: !!budget,
    hasCast: castRoles > 0,
    hasCrew: crewNeeds > 0,
    hasLocations: locations > 0,
    hasEquipmentPlan: equipmentPlan > 0,
    hasRiskPlan: !!riskPlan,
    riskGatePassed: !riskGateBlocking,
    hasContracts: contracts > 0,
  };

  const completedCount = Object.values(checklist).filter(Boolean).length;
  const readinessPercent = Math.round((completedCount / Object.keys(checklist).length) * 100);

  return NextResponse.json({
    checklist,
    readinessPercent,
    metrics: {
      scriptSceneCount: sceneCount,
      breakdownCharacterCount,
      breakdownCharactersWithScene: charactersWithScene,
      breakdownSceneCoveragePercent,
      scheduledShootDayCount: shootDays.length,
      shootDaysWithoutCallSheet: daysWithoutCallSheet,
      unsignedContractCount: unsignedContracts,
      openRiskItemCount: openRiskItems,
      unresolvedHighRiskCount,
      unresolvedWithoutInsurance,
      unresolvedLegalRiskCount,
      incompleteRiskChecklistCount: incompleteChecklistCount,
      riskGateBlocking,
    },
  });
}

