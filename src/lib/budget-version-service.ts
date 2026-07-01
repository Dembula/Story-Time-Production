import { prisma } from "@/lib/prisma";
import { resolveDefaultProjectBudget } from "@/lib/project-budget-access";

export async function listBudgetVersions(projectId: string) {
  const budget = await resolveDefaultProjectBudget(projectId);
  if (!budget) return { budget: null, versions: [] };

  const versions = await prisma.projectBudgetVersion.findMany({
    where: { budgetId: budget.id },
    orderBy: { version: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
    },
  });

  return { budget, versions };
}

export async function snapshotBudgetVersion(input: {
  projectId: string;
  userId: string;
  label?: string | null;
  notes?: string | null;
}) {
  const budget = await resolveDefaultProjectBudget(input.projectId);
  if (!budget) return { error: "No budget" as const, version: null };

  const last = await prisma.projectBudgetVersion.findFirst({
    where: { budgetId: budget.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (last?.version ?? 0) + 1;

  const version = await prisma.projectBudgetVersion.create({
    data: {
      budgetId: budget.id,
      version: nextVersion,
      label: input.label ?? `Version ${nextVersion}`,
      status: "LOCKED",
      totalPlanned: budget.totalPlanned,
      currency: budget.currency,
      generationSource: budget.generationSource,
      notes: input.notes ?? null,
      createdById: input.userId,
      lockedAt: new Date(),
      lines: {
        create: budget.lines.map((l) => ({
          department: l.department,
          name: l.name,
          quantity: l.quantity,
          unitCost: l.unitCost,
          total: l.total,
          notes: l.notes,
        })),
      },
    },
    include: { lines: true },
  });

  return { error: null, version };
}

export type BudgetVersionDiff = {
  department: string;
  name: string;
  versionATotal: number;
  versionBTotal: number;
  delta: number;
  deltaPct: number | null;
};

export async function compareBudgetVersions(
  projectId: string,
  versionAId: string,
  versionBId: string,
): Promise<BudgetVersionDiff[]> {
  const budget = await resolveDefaultProjectBudget(projectId);
  if (!budget) return [];

  const [a, b] = await Promise.all([
    prisma.projectBudgetVersion.findFirst({
      where: { id: versionAId, budgetId: budget.id },
      include: { lines: true },
    }),
    prisma.projectBudgetVersion.findFirst({
      where: { id: versionBId, budgetId: budget.id },
      include: { lines: true },
    }),
  ]);
  if (!a || !b) return [];

  const key = (d: string, n: string) => `${d}::${n}`;
  const mapA = new Map(a.lines.map((l) => [key(l.department, l.name), l.total]));
  const mapB = new Map(b.lines.map((l) => [key(l.department, l.name), l.total]));
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);

  const diffs: BudgetVersionDiff[] = [];
  for (const k of keys) {
    const [department, name] = k.split("::");
    const va = mapA.get(k) ?? 0;
    const vb = mapB.get(k) ?? 0;
    const delta = vb - va;
    diffs.push({
      department,
      name,
      versionATotal: va,
      versionBTotal: vb,
      delta,
      deltaPct: va > 0 ? Math.round((delta / va) * 1000) / 10 : null,
    });
  }

  return diffs.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}

export async function setActiveBudgetVersion(projectId: string, versionId: string) {
  const budget = await resolveDefaultProjectBudget(projectId);
  if (!budget) return null;

  const version = await prisma.projectBudgetVersion.findFirst({
    where: { id: versionId, budgetId: budget.id },
  });
  if (!version) return null;

  return prisma.projectBudget.update({
    where: { id: budget.id },
    data: { activeVersionId: versionId },
  });
}
