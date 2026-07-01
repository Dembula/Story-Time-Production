import { prisma } from "@/lib/prisma";
import { parseExpenseRow } from "@/lib/expense-service";
import { resolveDefaultProjectBudget } from "@/lib/project-budget-access";
import { poPipelineSummary } from "@/lib/purchase-order-service";

export type FinancialAnalyticsDashboard = {
  generatedAt: string;
  currency: string;
  kpis: {
    totalBudget: number;
    committedPos: number;
    actualSpend: number;
    payrollLiability: number;
    remaining: number;
    variancePct: number | null;
    burnRateWeekly: number;
    forecastAtCompletion: number;
  };
  waterfall: Array<{ label: string; amount: number; cumulative: number }>;
  departmentVariance: Array<{
    department: string;
    budgeted: number;
    actual: number;
    committed: number;
    variance: number;
    health: "healthy" | "watch" | "over";
  }>;
  poPipeline: Record<string, { count: number; total: number }>;
  vendorConcentration: Array<{ vendor: string; spend: number; pct: number }>;
  weeklyBurn: Array<{ week: string; spend: number; cumulative: number }>;
  unitScheduleExposure: Array<{ unit: string; shootDays: number; estimatedCost: number }>;
  payrollSummary: { draft: number; approved: number; paid: number; totalGross: number };
  alerts: string[];
};

function weekKey(d: Date): string {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  return start.toISOString().slice(0, 10);
}

export async function buildFinancialAnalyticsDashboard(projectId: string): Promise<FinancialAnalyticsDashboard> {
  const [budget, expensesRaw, pos, payrollRuns, shootDays] = await Promise.all([
    resolveDefaultProjectBudget(projectId),
    prisma.productionExpense.findMany({
      where: { projectId },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    }),
    prisma.purchaseOrder.findMany({ where: { projectId }, select: { status: true, total: true, department: true } }),
    prisma.payrollRun.findMany({ where: { projectId }, select: { status: true, totalGross: true, totalNet: true } }),
    prisma.shootDay.findMany({
      where: { projectId },
      select: { id: true, date: true, unit: true },
    }),
  ]);

  const expenses = expensesRaw.map(parseExpenseRow).filter((e) => !e.meta.softDeleted);
  const totalBudget = budget?.totalPlanned ?? 0;
  const currency = budget?.currency ?? "ZAR";
  const actualSpend = expenses.reduce((s, e) => s + e.amount, 0);

  const committedPos = pos
    .filter((p) => ["APPROVED", "SENT", "PARTIAL"].includes(p.status))
    .reduce((s, p) => s + p.total, 0);

  const payrollLiability = payrollRuns
    .filter((r) => ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(r.status))
    .reduce((s, r) => s + r.totalGross, 0);

  const remaining = totalBudget - actualSpend - committedPos;
  const variancePct =
    totalBudget > 0 ? Math.round(((actualSpend + committedPos - totalBudget) / totalBudget) * 1000) / 10 : null;

  const weeklyMap = new Map<string, number>();
  for (const e of expenses) {
    const wk = weekKey(new Date(e.spentAt));
    weeklyMap.set(wk, (weeklyMap.get(wk) ?? 0) + e.amount);
  }
  const weeklyBurn = [...weeklyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, spend], i, arr) => ({
      week,
      spend: Math.round(spend),
      cumulative: Math.round(arr.slice(0, i + 1).reduce((s, [, v]) => s + v, 0)),
    }));

  const burnRateWeekly =
    weeklyBurn.length > 0 ? weeklyBurn[weeklyBurn.length - 1]!.spend : actualSpend / Math.max(1, shootDays.length);
  const forecastAtCompletion = actualSpend + burnRateWeekly * Math.max(0, shootDays.length - weeklyBurn.length);

  const deptBudget = new Map<string, number>();
  for (const l of budget?.lines ?? []) {
    deptBudget.set(l.department, (deptBudget.get(l.department) ?? 0) + l.total);
  }
  const deptActual = new Map<string, number>();
  for (const e of expenses) {
    const d = e.department ?? e.meta.category;
    deptActual.set(d, (deptActual.get(d) ?? 0) + e.amount);
  }
  const deptCommitted = new Map<string, number>();
  for (const p of pos.filter((x) => ["APPROVED", "SENT", "PARTIAL"].includes(x.status))) {
    const d = p.department ?? "MISCELLANEOUS";
    deptCommitted.set(d, (deptCommitted.get(d) ?? 0) + p.total);
  }

  const departments = new Set([...deptBudget.keys(), ...deptActual.keys(), ...deptCommitted.keys()]);
  const departmentVariance = [...departments].map((department) => {
    const budgeted = deptBudget.get(department) ?? 0;
    const actual = deptActual.get(department) ?? 0;
    const committed = deptCommitted.get(department) ?? 0;
    const variance = actual + committed - budgeted;
    const pct = budgeted > 0 ? (actual + committed) / budgeted : 0;
    const health: "healthy" | "watch" | "over" = pct > 1 ? "over" : pct > 0.85 ? "watch" : "healthy";
    return { department, budgeted, actual, committed, variance, health };
  });

  const vendorSpend = new Map<string, number>();
  for (const e of expenses) {
    const v = e.vendor ?? "Unknown";
    vendorSpend.set(v, (vendorSpend.get(v) ?? 0) + e.amount);
  }
  const vendorConcentration = [...vendorSpend.entries()]
    .map(([vendor, spend]) => ({
      vendor,
      spend,
      pct: actualSpend > 0 ? Math.round((spend / actualSpend) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  const unitMap = new Map<string, { days: number; cost: number }>();
  for (const day of shootDays) {
    const unit = (day.unit ?? "A").toUpperCase();
    const entry = unitMap.get(unit) ?? { days: 0, cost: 0 };
    entry.days += 1;
    unitMap.set(unit, entry);
  }
  for (const e of expenses) {
    if (!e.meta.shootDayId) continue;
    const day = shootDays.find((d) => d.id === e.meta.shootDayId);
    const unit = (day?.unit ?? "A").toUpperCase();
    const entry = unitMap.get(unit) ?? { days: 0, cost: 0 };
    entry.cost += e.amount;
    unitMap.set(unit, entry);
  }
  const unitScheduleExposure = [...unitMap.entries()].map(([unit, v]) => ({
    unit,
    shootDays: v.days,
    estimatedCost: Math.round(v.cost),
  }));

  const payrollSummary = {
    draft: payrollRuns.filter((r) => r.status === "DRAFT").length,
    approved: payrollRuns.filter((r) => r.status === "APPROVED").length,
    paid: payrollRuns.filter((r) => r.status === "PAID").length,
    totalGross: payrollRuns.reduce((s, r) => s + r.totalGross, 0),
  };

  const waterfall = [
    { label: "Budget", amount: totalBudget, cumulative: totalBudget },
    { label: "Committed (POs)", amount: -committedPos, cumulative: totalBudget - committedPos },
    { label: "Actual spend", amount: -actualSpend, cumulative: totalBudget - committedPos - actualSpend },
    { label: "Payroll liability", amount: -payrollLiability, cumulative: remaining - payrollLiability },
  ];

  const alerts: string[] = [];
  if (variancePct != null && variancePct > 0) {
    alerts.push(`Project is ${variancePct}% over budget including commitments.`);
  }
  const pendingPos = pos.filter((p) => p.status === "PENDING_APPROVAL").length;
  if (pendingPos > 0) alerts.push(`${pendingPos} purchase order(s) awaiting approval.`);
  if (payrollLiability > 0) alerts.push(`R${Math.round(payrollLiability).toLocaleString()} payroll liability outstanding.`);

  return {
    generatedAt: new Date().toISOString(),
    currency,
    kpis: {
      totalBudget,
      committedPos,
      actualSpend,
      payrollLiability,
      remaining,
      variancePct,
      burnRateWeekly: Math.round(burnRateWeekly),
      forecastAtCompletion: Math.round(forecastAtCompletion),
    },
    waterfall,
    departmentVariance,
    poPipeline: poPipelineSummary(pos),
    vendorConcentration,
    weeklyBurn,
    unitScheduleExposure,
    payrollSummary,
    alerts,
  };
}
