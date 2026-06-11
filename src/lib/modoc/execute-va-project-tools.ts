import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import {
  type BudgetTemplate,
  runBudgetEngine,
} from "@/lib/budget-engine";
import type { ModocActionPayload } from "./action-types";
import type { ModocActionResult } from "./actions";
import { CAST_DAY_RATES_ZAR } from "./va-smart-budget";

const BUDGET_TEMPLATES = new Set<string>([
  "SHORT_FILM",
  "INDIE_FILM",
  "FEATURE_FILM",
  "TV_EPISODE",
  "SERIES_PILOT",
  "STUDENT_PRODUCTION",
  "COMMERCIAL_SHOOT",
]);

function resolveBudgetTemplate(raw?: string): BudgetTemplate {
  const upper = (raw ?? "SHORT_FILM").toUpperCase();
  return BUDGET_TEMPLATES.has(upper) ? (upper as BudgetTemplate) : "SHORT_FILM";
}

async function loadProjectBudgetInput(projectId: string) {
  return prisma.originalProject.findUnique({
    where: { id: projectId },
    include: {
      linkedCatalogueContent: {
        select: { duration: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      projectBudget: { include: { lines: true } },
      productionExpenses: { select: { amount: true, department: true } },
      crewRoleNeeds: {
        select: { department: true, role: true, seniority: true, notes: true },
      },
      castingRoles: { select: { name: true, status: true, dailyRate: true, importance: true } },
      equipmentPlanItems: {
        select: { category: true, quantity: true, notes: true },
      },
      shootDays: {
        select: { id: true, scenes: { select: { sceneId: true } } },
      },
      scenes: {
        include: {
          primaryLocation: {
            include: {
              locationListing: { select: { dailyRate: true, rules: true } },
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
}

async function runEngineForProject(projectId: string, templateOverride?: string) {
  const project = await loadProjectBudgetInput(projectId);
  if (!project) return null;

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

  const template = resolveBudgetTemplate(templateOverride ?? budget?.template ?? "SHORT_FILM");
  const shootDayCounts = new Map<string, number>();
  for (const day of project.shootDays) {
    for (const link of day.scenes) {
      shootDayCounts.set(link.sceneId, (shootDayCounts.get(link.sceneId) ?? 0) + 1);
    }
  }

  const linkedDuration = project.linkedCatalogueContent[0]?.duration ?? null;
  return runBudgetEngine({
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
      linkedSalaryAmount:
        salaryByRoleName.get(role.name.toLowerCase()) ?? role.dailyRate ?? null,
    })),
    equipmentItems: project.equipmentPlanItems.map((item) => ({
      category: item.category,
      quantity: item.quantity,
      notes: item.notes,
    })),
  });
}

export async function vaCreateBudget(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const template = resolveBudgetTemplate(payload.template);
  const existing = await prisma.projectBudget.findUnique({ where: { projectId } });
  if (existing) {
    return {
      ok: true,
      message: `Budget already exists (${existing.template}). Open Budget Builder to review or ask me to generate lines from your breakdown.`,
      data: { budgetId: existing.id },
    };
  }

  const budget = await prisma.projectBudget.create({
    data: { projectId, template, currency: "ZAR", totalPlanned: 0 },
  });
  return {
    ok: true,
    message: `Created ${template.replace(/_/g, " ").toLowerCase()} budget shell. Say "generate budget from breakdown" to populate line items.`,
    data: { budgetId: budget.id },
  };
}

export async function vaGenerateBudgetFromBreakdown(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const sceneCount = await prisma.projectScene.count({ where: { projectId } });
  if (sceneCount === 0) {
    return {
      ok: false,
      error: "No scenes yet — sync scenes from script or run a breakdown first.",
      status: 400,
    };
  }

  const template = resolveBudgetTemplate(payload.template);
  let budget = await prisma.projectBudget.findUnique({ where: { projectId } });
  if (!budget) {
    budget = await prisma.projectBudget.create({
      data: { projectId, template, currency: "ZAR", totalPlanned: 0 },
    });
  }

  const engine = await runEngineForProject(projectId, template);
  if (!engine) {
    return { ok: false, error: "Could not load project for budget engine.", status: 500 };
  }

  const lineItems = engine.sceneLineItems;
  if (lineItems.length === 0) {
    return {
      ok: false,
      error: "Budget engine produced no lines — ensure breakdown data exists on scenes.",
      status: 400,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectBudgetLine.deleteMany({ where: { budgetId: budget!.id } });
    for (const item of lineItems) {
      await tx.projectBudgetLine.create({
        data: {
          budgetId: budget!.id,
          department: item.department,
          name: item.name,
          quantity: item.quantity,
          unitCost: item.unitCost,
          total: item.total,
          notes: item.notes || null,
        },
      });
    }
    await tx.projectBudget.update({
      where: { id: budget!.id },
      data: { totalPlanned: engine.dashboard.estimatedTotal, template },
    });
  });

  const total = engine.dashboard.estimatedTotal;
  return {
    ok: true,
    message: `Generated ${lineItems.length} budget line(s) from your breakdown — estimated total R${total.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}.`,
    data: { lineCount: lineItems.length, totalPlanned: total },
  };
}

export async function vaAddBudgetLine(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  if (!payload.name?.trim()) {
    return { ok: false, error: "name is required for budget line", status: 400 };
  }

  const budget =
    (await prisma.projectBudget.findUnique({ where: { projectId } })) ??
    (await prisma.projectBudget.create({
      data: {
        projectId,
        template: resolveBudgetTemplate(payload.template),
        currency: "ZAR",
        totalPlanned: 0,
      },
    }));

  const qty = payload.quantity ?? 1;
  const unitCost = payload.unitCost ?? 0;
  const total = payload.total ?? qty * unitCost;

  const line = await prisma.projectBudgetLine.create({
    data: {
      budgetId: budget.id,
      department: payload.department ?? "MANUAL",
      name: payload.name.trim(),
      quantity: qty,
      unitCost,
      total,
      notes: payload.notes ?? null,
    },
  });

  const allLines = await prisma.projectBudgetLine.findMany({
    where: { budgetId: budget.id },
    select: { total: true, quantity: true, unitCost: true },
  });
  const totalPlanned = allLines.reduce((acc, row) => {
    const explicit = row.total ?? null;
    if (explicit != null && Number.isFinite(explicit)) return acc + explicit;
    return acc + (row.quantity ?? 1) * (row.unitCost ?? 0);
  }, 0);
  await prisma.projectBudget.update({
    where: { id: budget.id },
    data: { totalPlanned },
  });

  return {
    ok: true,
    message: `Added budget line "${payload.name}" (R${total.toLocaleString("en-ZA")}). Project total now R${totalPlanned.toLocaleString("en-ZA")}.`,
    data: { lineId: line.id, totalPlanned },
  };
}

export async function vaCreateShootDay(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const dateIso = payload.date ?? payload.startAt ?? new Date().toISOString();
  const day = await prisma.shootDay.create({
    data: {
      projectId,
      date: new Date(dateIso),
      status: "PLANNED",
      unit: payload.unit ?? null,
      callTime: payload.callTime ?? null,
      wrapTime: payload.wrapTime ?? null,
      locationSummary: payload.locationSummary ?? null,
    },
  });

  const label = new Date(dateIso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return {
    ok: true,
    message: `Shoot day scheduled for ${label}${payload.locationSummary ? ` at ${payload.locationSummary}` : ""}.`,
    data: { shootDayId: day.id },
  };
}

export async function vaSyncCastingFromBreakdown(projectId: string): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const characters = await prisma.breakdownCharacter.findMany({ where: { projectId } });
  if (characters.length === 0) {
    return {
      ok: false,
      error: "No breakdown characters — run a script breakdown first.",
      status: 400,
    };
  }

  const existingRoles = await prisma.castingRole.findMany({
    where: { projectId },
    select: { name: true },
  });
  const existingNames = new Set(existingRoles.map((r) => r.name.toLowerCase()));
  let created = 0;
  let skipped = 0;

  for (const char of characters) {
    if (existingNames.has(char.name.toLowerCase())) {
      skipped++;
      continue;
    }
    const imp = (char.importance ?? "SUPPORTING").toUpperCase();
    const dailyRate = CAST_DAY_RATES_ZAR[imp] ?? CAST_DAY_RATES_ZAR.SUPPORTING;
    await prisma.castingRole.create({
      data: {
        projectId,
        name: char.name,
        description: char.description,
        status: "OPEN",
        breakdownCharacterId: char.id,
        importance: imp,
        dailyRate,
      },
    });
    created++;
  }

  return {
    ok: true,
    message: `Casting portal synced — ${created} role(s) created${skipped > 0 ? `, ${skipped} already existed` : ""}.`,
    data: { created, skipped },
  };
}

export async function vaCreateCastingRole(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };
  if (!payload.name?.trim() && !payload.title?.trim()) {
    return { ok: false, error: "name is required for casting role", status: 400 };
  }

  const name = (payload.name ?? payload.title)!.trim();
  const role = await prisma.castingRole.create({
    data: {
      projectId,
      name,
      description: payload.description ?? null,
      status: "OPEN",
    },
  });
  return {
    ok: true,
    message: `Casting role "${name}" created.`,
    data: { roleId: role.id },
  };
}

export async function vaCreateCrewNeed(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };
  if (!payload.role?.trim() && !payload.title?.trim()) {
    return { ok: false, error: "role is required for crew need", status: 400 };
  }

  const roleName = (payload.role ?? payload.title)!.trim();
  const need = await prisma.crewRoleNeed.create({
    data: {
      projectId,
      role: roleName,
      department: payload.department ?? null,
      notes: payload.description ?? payload.notes ?? null,
    },
  });
  return {
    ok: true,
    message: `Crew need "${roleName}" added${payload.department ? ` (${payload.department})` : ""}.`,
    data: { crewNeedId: need.id },
  };
}

export async function vaCreateProductionExpense(
  userId: string,
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const amount = payload.amount ?? payload.total ?? 0;
  if (!payload.description?.trim() && !payload.title?.trim()) {
    return { ok: false, error: "description is required for expense", status: 400 };
  }

  const expense = await prisma.productionExpense.create({
    data: {
      projectId,
      description: (payload.description ?? payload.title)!.trim(),
      amount,
      department: payload.department ?? null,
      vendor: payload.vendor ?? null,
      spentAt: payload.date ? new Date(payload.date) : new Date(),
      createdById: userId,
    },
  });

  return {
    ok: true,
    message: `Logged expense R${amount.toLocaleString("en-ZA")} — "${expense.description}".`,
    data: { expenseId: expense.id },
  };
}

export async function vaUpdateIdeaNotes(
  projectId: string,
  payload: ModocActionPayload,
): Promise<ModocActionResult> {
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };

  const existing = await prisma.projectIdea.findFirst({ where: { projectId } });
  const data = {
    ...(payload.logline !== undefined ? { logline: payload.logline } : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    ...(payload.genres !== undefined ? { genres: payload.genres } : {}),
    ...(payload.title !== undefined ? { title: payload.title } : {}),
  };

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "Provide logline, notes, genres, or title to update.", status: 400 };
  }

  if (existing) {
    await prisma.projectIdea.update({ where: { id: existing.id }, data });
  } else {
    const project = await prisma.originalProject.findUnique({
      where: { id: projectId },
      select: { title: true },
    });
    await prisma.projectIdea.create({
      data: {
        projectId,
        title: payload.title ?? project?.title ?? "Project idea",
        logline: payload.logline ?? null,
        notes: payload.notes ?? null,
        genres: payload.genres ?? null,
      },
    });
  }

  return {
    ok: true,
    message: "Idea development notes saved.",
    data: { projectId },
  };
}
