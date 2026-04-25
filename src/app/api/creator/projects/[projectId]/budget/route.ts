import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  type BudgetTemplate,
  runBudgetEngine,
} from "@/lib/budget-engine";

async function ensureAccess(projectId: string) {
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

  return { error: null as NextResponse | null, userId };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: {
      linkedCatalogueContent: {
        select: { duration: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      projectBudget: {
        include: { lines: true },
      },
      productionExpenses: {
        select: { amount: true, department: true },
      },
      crewRoleNeeds: {
        select: {
          department: true,
          role: true,
          seniority: true,
          notes: true,
        },
      },
      castingRoles: {
        select: {
          name: true,
          status: true,
        },
      },
      equipmentPlanItems: {
        select: {
          category: true,
          quantity: true,
          notes: true,
        },
      },
      shootDays: {
        select: {
          id: true,
          scenes: { select: { sceneId: true } },
        },
      },
      scenes: {
        include: {
          primaryLocation: {
            include: {
              locationListing: {
                select: { dailyRate: true, rules: true },
              },
            },
          },
          breakdownCharacters: { select: { importance: true } },
          breakdownProps: { select: { id: true } },
          breakdownWardrobes: { select: { id: true } },
          breakdownExtras: { select: { quantity: true } },
          breakdownVehicles: { select: { id: true } },
          breakdownStunts: { select: { id: true } },
          breakdownSfxs: { select: { id: true } },
          breakdownMakeups: { select: { id: true } },
        },
      },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const budget = project.projectBudget;
  const salaryByRoleName = new Map<string, number>();
  for (const line of budget?.lines ?? []) {
    if ((line.department ?? "").toUpperCase() !== "CAST") continue;
    const amount = Number(line.unitCost ?? line.total ?? 0);
    if (!Number.isFinite(amount)) continue;
    const normalized = line.name
      .replace(/^Salary\s*·\s*/i, "")
      .trim()
      .toLowerCase();
    if (!normalized) continue;
    salaryByRoleName.set(normalized, amount);
  }
  const templateCandidate = (budget?.template ?? "SHORT_FILM") as BudgetTemplate;
  const template: BudgetTemplate =
    [
      "SHORT_FILM",
      "INDIE_FILM",
      "FEATURE_FILM",
      "TV_EPISODE",
      "SERIES_PILOT",
      "STUDENT_PRODUCTION",
      "COMMERCIAL_SHOOT",
    ].includes(templateCandidate)
      ? templateCandidate
      : "SHORT_FILM";

  const shootDayCounts = new Map<string, number>();
  for (const day of project.shootDays) {
    for (const link of day.scenes) {
      shootDayCounts.set(link.sceneId, (shootDayCounts.get(link.sceneId) ?? 0) + 1);
    }
  }

  const linkedDuration = project.linkedCatalogueContent[0]?.duration ?? null;
  const engine = runBudgetEngine({
    template,
    projectDurationMinutes: linkedDuration ?? null,
    logisticsDistanceKm: null,
    shootDaysCount: project.shootDays.length,
    scenes: project.scenes.map((scene) => ({
      id: scene.id,
      number: scene.number,
      heading: scene.heading,
      intExt: scene.intExt,
      timeOfDay: scene.timeOfDay,
      pageCount: scene.pageCount,
      storyDay: scene.storyDay,
      primaryLocationName: scene.primaryLocation?.name ?? null,
      locationDailyRate: scene.primaryLocation?.locationListing?.dailyRate ?? null,
      locationRules: scene.primaryLocation?.locationListing?.rules ?? null,
      characters: scene.breakdownCharacters,
      propsCount: scene.breakdownProps.length,
      wardrobeCount: scene.breakdownWardrobes.length,
      extrasCount: scene.breakdownExtras.length,
      extrasQty: scene.breakdownExtras.reduce((acc, row) => acc + (row.quantity ?? 0), 0),
      vehiclesCount: scene.breakdownVehicles.length,
      stuntsCount: scene.breakdownStunts.length,
      sfxCount: scene.breakdownSfxs.length,
      makeupsCount: scene.breakdownMakeups.length,
      shootDaysAssigned: shootDayCounts.get(scene.id) ?? 0,
    })),
    manualLines: (budget?.lines ?? []).map((line) => ({
      department: line.department,
      name: line.name,
      quantity: line.quantity,
      unitCost: line.unitCost,
      total: line.total,
    })),
    expenses: project.productionExpenses,
    crewNeeds: project.crewRoleNeeds,
    castRoles: project.castingRoles.map((role) => ({
      name: role.name,
      status: role.status,
      linkedSalaryAmount: salaryByRoleName.get(role.name.toLowerCase()) ?? null,
    })),
    equipmentItems: project.equipmentPlanItems.map((item) => ({
      category: item.category,
      quantity: item.quantity,
      notes: item.notes,
    })),
  });

  return NextResponse.json({
    budget,
    engine,
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        template: BudgetTemplate;
      }
    | null;

  if (!body?.template) {
    return NextResponse.json({ error: "Missing template" }, { status: 400 });
  }

  const existing = await prisma.projectBudget.findUnique({
    where: { projectId },
  });
  if (existing) {
    return NextResponse.json({ budget: existing }, { status: 200 });
  }

  const budget = await prisma.projectBudget.create({
    data: {
      projectId,
      template: body.template,
      currency: "ZAR",
      totalPlanned: 0,
    },
  });
  return NextResponse.json({ budget }, { status: 201 });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        lines: {
          id?: string;
          department?: string;
          name?: string;
          quantity?: number;
          unitCost?: number;
          total?: number;
          notes?: string | null;
        }[];
      }
    | null;

  if (!body?.lines) {
    return NextResponse.json({ error: "Missing lines" }, { status: 400 });
  }

  const budget = await prisma.projectBudget.upsert({
    where: { projectId },
    create: {
      projectId,
      template: "SHORT_FILM",
      currency: "ZAR",
      totalPlanned: 0,
    },
    update: {},
  });

  await prisma.$transaction(async (tx) => {
    const submittedIds = new Set(
      body.lines.map((l) => l.id).filter((id): id is string => Boolean(id)),
    );
    const existingLines = await tx.projectBudgetLine.findMany({
      where: { budgetId: budget.id },
      select: { id: true },
    });
    for (const row of existingLines) {
      if (!submittedIds.has(row.id)) {
        await tx.projectBudgetLine.delete({ where: { id: row.id } });
      }
    }

    for (const line of body.lines) {
      const data: {
        department?: string;
        name?: string;
        quantity?: number | null;
        unitCost?: number | null;
        total?: number;
        notes?: string | null;
      } = {};

      if (line.department !== undefined) data.department = line.department ?? "";
      if (line.name !== undefined) data.name = line.name ?? "";
      if (line.quantity !== undefined) data.quantity = line.quantity ?? 1;
      if (line.unitCost !== undefined) data.unitCost = line.unitCost ?? 0;
      if (line.total !== undefined) data.total = line.total ?? 0;
      if (line.notes !== undefined) data.notes = line.notes ?? null;

      if (line.id) {
        await tx.projectBudgetLine.updateMany({
          where: { id: line.id, budgetId: budget.id },
          data,
        });
      } else {
        await tx.projectBudgetLine.create({
          data: {
            budgetId: budget.id,
            department: line.department ?? "",
            name: line.name ?? "",
            quantity: line.quantity ?? 1,
            unitCost: line.unitCost ?? 0,
            total: line.total ?? 0,
            notes: line.notes ?? null,
          },
        });
      }
    }

    const freshLines = await tx.projectBudgetLine.findMany({
      where: { budgetId: budget.id },
      select: { total: true, quantity: true, unitCost: true },
    });
    const totalPlanned = freshLines.reduce((acc, line) => {
      const explicit = line.total ?? null;
      if (explicit != null && Number.isFinite(explicit)) return acc + explicit;
      return acc + (line.quantity ?? 0) * (line.unitCost ?? 0);
    }, 0);
    await tx.projectBudget.update({
      where: { id: budget.id },
      data: { totalPlanned },
    });
  }, { timeout: 60000, maxWait: 10000 });

  const updatedBudget = await prisma.projectBudget.findUnique({
    where: { id: budget.id },
    include: { lines: true },
  });

  return NextResponse.json({ budget: updatedBudget });
}
