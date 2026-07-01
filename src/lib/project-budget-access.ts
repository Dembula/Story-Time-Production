import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../generated/prisma";

const budgetWithLines = { lines: true } satisfies Prisma.ProjectBudgetInclude;

export type ProjectBudgetWithLines = Prisma.ProjectBudgetGetPayload<{
  include: typeof budgetWithLines;
}>;

export async function listProjectBudgets(projectId: string) {
  return prisma.projectBudget.findMany({
    where: { projectId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      isDefault: true,
      template: true,
      totalPlanned: true,
      currency: true,
      generationSource: true,
      lastGeneratedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function resolveProjectBudget(
  projectId: string,
  budgetId?: string | null,
): Promise<ProjectBudgetWithLines | null> {
  if (budgetId) {
    return prisma.projectBudget.findFirst({
      where: { id: budgetId, projectId },
      include: budgetWithLines,
    });
  }

  const defaultBudget = await prisma.projectBudget.findFirst({
    where: { projectId, isDefault: true },
    include: budgetWithLines,
  });
  if (defaultBudget) return defaultBudget;

  return prisma.projectBudget.findFirst({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: budgetWithLines,
  });
}

/** VA, expenses, casting sync, and other integrations use the default budget. */
export async function resolveDefaultProjectBudget(projectId: string) {
  return resolveProjectBudget(projectId, null);
}

export async function createProjectBudget(params: {
  projectId: string;
  template: string;
  name?: string;
  isDefault?: boolean;
}): Promise<ProjectBudgetWithLines> {
  const existingCount = await prisma.projectBudget.count({
    where: { projectId: params.projectId },
  });
  const isDefault = params.isDefault ?? existingCount === 0;
  const name =
    params.name?.trim() ||
    (existingCount === 0 ? "Main budget" : `Budget ${existingCount + 1}`);

  if (isDefault) {
    await prisma.projectBudget.updateMany({
      where: { projectId: params.projectId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.projectBudget.create({
    data: {
      projectId: params.projectId,
      template: params.template,
      name,
      currency: "ZAR",
      totalPlanned: 0,
      isDefault,
    },
    include: budgetWithLines,
  });
}

export async function setDefaultProjectBudget(projectId: string, budgetId: string) {
  const budget = await prisma.projectBudget.findFirst({
    where: { id: budgetId, projectId },
  });
  if (!budget) return null;

  await prisma.$transaction([
    prisma.projectBudget.updateMany({
      where: { projectId },
      data: { isDefault: false },
    }),
    prisma.projectBudget.update({
      where: { id: budgetId },
      data: { isDefault: true },
    }),
  ]);

  return budget;
}

export async function renameProjectBudget(
  projectId: string,
  budgetId: string,
  name: string,
) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  return prisma.projectBudget.updateMany({
    where: { id: budgetId, projectId },
    data: { name: trimmed },
  });
}

/** Resolve default budget inside a transaction (cast/crew line sync). */
export async function ensureDefaultProjectBudgetInTx(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  const existing =
    (await tx.projectBudget.findFirst({
      where: { projectId, isDefault: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await tx.projectBudget.findFirst({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }));
  if (existing) return existing;

  return tx.projectBudget.create({
    data: {
      projectId,
      template: "SHORT_FILM",
      currency: "ZAR",
      totalPlanned: 0,
      name: "Main budget",
      isDefault: true,
    },
  });
}
