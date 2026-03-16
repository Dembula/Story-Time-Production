import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: { projectId: string };
}

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

export async function GET(_req: NextRequest, { params }: Params) {
  const access = await ensureReadinessAccess(params.projectId);
  if (access.error) return access.error;

  const projectId = params.projectId;

  const [budget, castRoles, crewNeeds, locations, equipmentPlan, riskPlan, contracts] =
    await Promise.all([
      prisma.projectBudget.findUnique({ where: { projectId } }),
      prisma.castingRole.count({ where: { projectId } }),
      prisma.crewRoleNeed.count({ where: { projectId } }),
      prisma.breakdownLocation.count({ where: { projectId } }),
      prisma.equipmentPlanItem.count({ where: { projectId } }),
      prisma.riskPlan.findUnique({ where: { projectId } }),
      prisma.projectContract.count({ where: { projectId } }),
    ]);

  const checklist = {
    hasBudget: !!budget,
    hasCast: castRoles > 0,
    hasCrew: crewNeeds > 0,
    hasLocations: locations > 0,
    hasEquipmentPlan: equipmentPlan > 0,
    hasRiskPlan: !!riskPlan,
    hasContracts: contracts > 0,
  };

  const completedCount = Object.values(checklist).filter(Boolean).length;
  const readinessPercent = Math.round((completedCount / Object.keys(checklist).length) * 100);

  return NextResponse.json({
    checklist,
    readinessPercent,
  });
}

