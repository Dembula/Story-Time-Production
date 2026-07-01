import { NextRequest, NextResponse } from "next/server";
import { resolveDefaultProjectBudget } from "@/lib/project-budget-access";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseEmbeddedMeta, embedMeta } from "@/lib/marketplace-profile-meta";
import {
  asNum,
  buildExpenseDashboard,
  createProductionExpense,
  parseExpenseRow,
  updateProductionExpense,
  softDeleteProductionExpense,
} from "@/lib/expense-service";
import type { ExpenseMeta } from "@/lib/expense-types";
import { normalizeExpenseCategory } from "@/lib/expense-types";

async function ensureExpenseAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null as string | null };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true, shootDays: { select: { id: true } } },
  });

  if (!project) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null as string | null };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null as string | null };
  }

  return { error: null as NextResponse | null, userId, shootDaysCount: project.shootDays.length };
}

function expenseHasLink(
  rows: ReturnType<typeof parseExpenseRow>[],
  field: "linkedContractId" | "linkedEquipmentPlanItemId",
  id: string,
) {
  return rows.some((e) => !e.meta.softDeleted && e.meta[field] === id);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureExpenseAccess(projectId);
  if (access.error) return access.error;

  const [expensesRaw, budget, funding, shootDays, scenes, incidents, tasks, contracts] = await Promise.all([
    prisma.productionExpense.findMany({
      where: { projectId },
      orderBy: { spentAt: "desc" },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    }),
    resolveDefaultProjectBudget(projectId),
    prisma.fundingRequest.findUnique({ where: { projectId } }),
    prisma.shootDay.findMany({ where: { projectId }, select: { id: true, date: true, status: true } }),
    prisma.projectScene.findMany({ where: { projectId }, select: { id: true, number: true, heading: true } }),
    prisma.incidentReport.findMany({ where: { projectId, resolved: false }, select: { id: true, severity: true } }),
    prisma.projectTask.findMany({ where: { projectId }, select: { id: true, status: true, sceneId: true, shootDayId: true } }),
    prisma.projectContract.findMany({ where: { projectId }, select: { id: true, status: true, subject: true } }),
  ]);

  const expenseRows = expensesRaw.map(parseExpenseRow).filter((e) => !e.meta.softDeleted);
  const dayById = new Map(shootDays.map((d) => [d.id, d]));
  const sceneById = new Map(scenes.map((s) => [s.id, s]));

  const dashboard = buildExpenseDashboard(
    expensesRaw.map(parseExpenseRow),
    budget?.lines ?? [],
    asNum(budget?.totalPlanned),
    asNum(funding?.amount),
    access.shootDaysCount ?? shootDays.length,
  );

  const fundingLimit = asNum(funding?.amount);
  const alerts = [
    ...(dashboard.totalBudget > 0 && dashboard.totalSpend > dashboard.totalBudget
      ? [{ type: "BUDGET_OVERRUN", severity: "HIGH", message: `Total spend is over budget by R${(dashboard.totalSpend - dashboard.totalBudget).toLocaleString()}.` }]
      : []),
    ...(fundingLimit > 0 && dashboard.totalSpend > fundingLimit
      ? [{ type: "FUNDING_LIMIT_EXCEEDED", severity: "HIGH", message: `Spend exceeds available funding by R${(dashboard.totalSpend - fundingLimit).toLocaleString()}.` }]
      : []),
    ...dashboard.burnByDay
      .filter((d) => d.amount > dashboard.burnRateDaily * 1.8 && d.amount > 0)
      .slice(-5)
      .map((d) => ({
        type: "HIGH_SPEND_DAY",
        severity: "MEDIUM",
        message: `High-spend day ${d.date}: R${Math.round(d.amount).toLocaleString()}.`,
      })),
    ...dashboard.comparisonByDepartment
      .filter((d) => d.health === "over")
      .map((d) => ({
        type: "DEPARTMENT_OVERRUN",
        severity: "HIGH",
        message: `${d.key.replaceAll("_", " ")} overrun by R${Math.round(d.actual - d.budgeted).toLocaleString()}.`,
      })),
    ...(dashboard.missingReceipts > 0
      ? [{ type: "MISSING_RECEIPTS", severity: "MEDIUM", message: `${dashboard.missingReceipts} expense(s) missing receipts.` }]
      : []),
    ...(dashboard.duplicateCount > 0
      ? [{ type: "DUPLICATE_DETECTED", severity: "HIGH", message: `${dashboard.duplicateCount} possible duplicate(s) flagged.` }]
      : []),
  ];

  const byScene = expenseRows.reduce((acc, e) => {
    const sceneId = e.meta.sceneId;
    if (!sceneId) return acc;
    acc[sceneId] = (acc[sceneId] ?? 0) + asNum(e.amount);
    return acc;
  }, {} as Record<string, number>);
  const byDay = expenseRows.reduce((acc, e) => {
    const dayId = e.meta.shootDayId;
    const key = dayId ?? "__unlinked__";
    acc[key] = (acc[key] ?? 0) + asNum(e.amount);
    return acc;
  }, {} as Record<string, number>);

  const url = new URL(req.url);
  if (url.searchParams.get("format") === "csv") {
    const header = [
      "id","title","category","department","amount","spentAt","vendor","paymentStatus","approvalStatus","scene","shootDay","fundingSource","notes",
    ];
    const lines = [header.join(",")];
    for (const e of expenseRows) {
      const scene = e.meta.sceneId ? sceneById.get(e.meta.sceneId)?.number ?? e.meta.sceneId : "";
      const day = e.meta.shootDayId ? dayById.get(e.meta.shootDayId)?.date.toISOString().slice(0, 10) ?? e.meta.shootDayId : "";
      lines.push(
        [
          e.id,
          `${e.meta.title ?? ""}`.replace(/,/g, " "),
          `${e.meta.category ?? ""}`,
          `${e.department ?? ""}`,
          `${e.amount}`,
          `${e.spentAt}`,
          `${e.vendor ?? ""}`.replace(/,/g, " "),
          `${e.meta.paymentStatus ?? ""}`,
          `${e.meta.approvalStatus ?? ""}`,
          `${scene}`,
          `${day}`,
          `${e.meta.fundingSource ?? ""}`.replace(/,/g, " "),
          `${e.meta.notes ?? ""}`.replace(/,/g, " "),
        ].join(","),
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="production-expenses-${projectId}.csv"`,
      },
    });
  }

  return NextResponse.json({
    expenses: expenseRows,
    budgetLines: (budget?.lines ?? []).map((l) => ({
      id: l.id,
      department: l.department,
      name: l.name,
      total: asNum(l.total ?? asNum(l.quantity) * asNum(l.unitCost)),
    })),
    dashboard: {
      ...dashboard,
      fundingLimit,
      fundingRemaining: fundingLimit > 0 ? Math.max(0, fundingLimit - dashboard.totalSpend) : null,
      openIncidents: incidents.length,
      blockedTasks: tasks.filter((t) => t.status === "BLOCKED").length,
      signedContracts: contracts.filter((c) => ["SIGNED", "EXECUTED", "CLOSED", "COMPLETED"].includes(c.status)).length,
      totalContracts: contracts.length,
    },
    comparison: {
      byDepartment: dashboard.comparisonByDepartment,
      byScene: Object.entries(byScene).map(([sceneId, actual]) => ({
        sceneId,
        sceneNumber: sceneById.get(sceneId)?.number ?? sceneId,
        budgeted: 0,
        actual,
        variance: -actual,
      })),
      byProductionDay: Object.entries(byDay).map(([shootDayId, actual]) => ({
        shootDayId,
        date: shootDayId !== "__unlinked__" ? dayById.get(shootDayId)?.date.toISOString() ?? null : null,
        budgeted: 0,
        actual,
        variance: -actual,
      })),
      overall: {
        budgeted: dashboard.totalBudget,
        actual: dashboard.totalSpend,
        remaining: dashboard.remainingBudget,
        variance: dashboard.variance,
      },
    },
    burnRate: dashboard.burnByDay,
    cashFlowTimeline: dashboard.burnByDay.map((d, i, arr) => ({
      date: d.date,
      amount: d.amount,
      cumulative: arr.slice(0, i + 1).reduce((s, x) => s + x.amount, 0),
    })),
    alerts,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureExpenseAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (body.action === "AUTO_CAPTURE") {
    const existing = (await prisma.productionExpense.findMany({
      where: { projectId },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    })).map(parseExpenseRow);

    const created: unknown[] = [];
    const skipped: string[] = [];
    const now = new Date();
    const autoSource = (body.autoSource as string) ?? "SIGNED_CONTRACTS";

    if (autoSource === "SIGNED_CONTRACTS" || !body.autoSource) {
      const contracts = await prisma.projectContract.findMany({
        where: { projectId, status: { in: ["SIGNED", "EXECUTED", "COMPLETED"] } },
        select: { id: true, type: true, subject: true, vendorName: true },
        take: 30,
      });
      for (const c of contracts) {
        if (expenseHasLink(existing, "linkedContractId", c.id)) {
          skipped.push(c.id);
          continue;
        }
        const cat = c.type.toUpperCase().includes("ACT") ? "CAST" : c.type.toUpperCase().includes("CREW") ? "CREW" : "MISCELLANEOUS";
        const { expense } = await createProductionExpense({
          projectId,
          userId,
          amount: 0,
          title: c.subject ?? "Contract expense",
          description: c.subject ?? "Auto-generated contract expense",
          category: cat,
          vendor: c.vendorName,
          approvalStatus: "APPROVED",
          paymentStatus: "UNPAID",
          linkedContractId: c.id,
          autoGeneratedFrom: "SIGNED_CONTRACTS",
          spentAt: now,
          skipDuplicateCheck: true,
        });
        created.push(expense);
      }
    }

    if (autoSource === "EQUIPMENT_USAGE" || !body.autoSource) {
      const items = await prisma.equipmentPlanItem.findMany({
        where: { projectId },
        select: { id: true, category: true, quantity: true, notes: true },
        take: 40,
      });
      for (const item of items) {
        if (expenseHasLink(existing, "linkedEquipmentPlanItemId", item.id)) {
          skipped.push(item.id);
          continue;
        }
        const rate = parseEmbeddedMeta<{ dailyRate?: number | null }>(item.notes).meta?.dailyRate ?? 0;
        if (!rate || rate <= 0) continue;
        const { expense } = await createProductionExpense({
          projectId,
          userId,
          amount: rate * Math.max(1, item.quantity),
          title: `${item.category} usage`,
          description: `Auto equipment usage: ${item.category}`,
          category: "EQUIPMENT",
          approvalStatus: "APPROVED",
          paymentStatus: "UNPAID",
          linkedEquipmentPlanItemId: item.id,
          autoGeneratedFrom: "EQUIPMENT_USAGE",
          spentAt: now,
          skipDuplicateCheck: true,
        });
        created.push(expense);
      }
    }

    return NextResponse.json({ createdCount: created.length, skippedCount: skipped.length, created, skipped });
  }

  const amount = asNum(body.amount);
  if (amount <= 0) return NextResponse.json({ error: "Missing amount" }, { status: 400 });

  try {
    const { expense, duplicateWarnings } = await createProductionExpense({
      projectId,
      userId,
      amount,
      title: (body.title as string) ?? null,
      description: (body.description as string) ?? null,
      category: (body.category as string) ?? (body.department as string) ?? null,
      department: (body.department as string) ?? null,
      vendor: (body.vendor as string) ?? null,
      budgetLineId: (body.budgetLineId as string) ?? null,
      sceneId: (body.sceneId as string) ?? null,
      shootDayId: (body.shootDayId as string) ?? null,
      paymentMethod: body.paymentMethod as ExpenseMeta["paymentMethod"],
      notes: (body.notes as string) ?? null,
      receiptUrls: (body.receiptUrls as string[]) ?? [],
      paymentProofUrls: (body.paymentProofUrls as string[]) ?? [],
      fundingSource: (body.fundingSource as string) ?? null,
      fundingSourceId: (body.fundingSourceId as string) ?? null,
      approvalStatus: (body.approvalStatus as ExpenseMeta["approvalStatus"]) ?? "PENDING",
      paymentStatus: (body.paymentStatus as ExpenseMeta["paymentStatus"]) ?? "UNPAID",
      paymentDueAt: (body.paymentDueAt as string) ?? null,
      spentAt: (body.spentAt as string) ?? null,
      linkedBudgetLineId: (body.budgetLineId as string) ?? null,
      receiptNumber: (body.receiptNumber as string) ?? null,
      invoiceNumber: (body.invoiceNumber as string) ?? null,
      vatAmount: body.vatAmount != null ? asNum(body.vatAmount) : null,
      subtotal: body.subtotal != null ? asNum(body.subtotal) : null,
      ocrConfidence: body.ocrConfidence != null ? asNum(body.ocrConfidence) : null,
      ocrRawText: (body.ocrRawText as string) ?? null,
      forceCreate: body.forceCreate === true,
    });

    return NextResponse.json(
      {
        expense,
        duplicateWarnings: duplicateWarnings.map((d) => ({ id: d.id, title: d.meta.title, amount: d.amount })),
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create expense" }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureExpenseAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        amount?: number;
        department?: string | null;
        vendor?: string | null;
        description?: string | null;
        spentAt?: string;
        meta?: Partial<ExpenseMeta>;
      }
    | null;
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const expense = await updateProductionExpense(projectId, body.id, userId, body);
    return NextResponse.json({ expense });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureExpenseAccess(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const expense = await softDeleteProductionExpense(projectId, id, userId);
    return NextResponse.json({ expense });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed" }, { status: 404 });
  }
}
