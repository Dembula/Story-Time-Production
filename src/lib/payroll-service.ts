import { prisma } from "@/lib/prisma";
import { createProductionExpense } from "@/lib/expense-service";

const DEFAULT_TAX_RATE = 0.25;

export type PayrollLineDraft = {
  personLabel: string;
  role?: string | null;
  department?: string | null;
  shootDayId?: string | null;
  castingInvitationId?: string | null;
  crewInvitationId?: string | null;
  daysWorked?: number;
  dayRate?: number;
  unit?: string | null;
  notes?: string | null;
};

export async function listPayrollRuns(projectId: string) {
  return prisma.payrollRun.findMany({
    where: { projectId },
    orderBy: { periodStart: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
    },
  });
}

export async function getPayrollRun(projectId: string, runId: string) {
  return prisma.payrollRun.findFirst({
    where: { id: runId, projectId },
    include: {
      lines: {
        orderBy: { personLabel: "asc" },
        include: { shootDay: { select: { id: true, date: true, unit: true } } },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

function computePayrollLine(line: PayrollLineDraft) {
  const days = Math.max(0, Number(line.daysWorked ?? 1));
  const rate = Math.max(0, Number(line.dayRate ?? 0));
  const gross = Math.round(days * rate * 100) / 100;
  const tax = Math.round(gross * DEFAULT_TAX_RATE * 100) / 100;
  const net = Math.round((gross - tax) * 100) / 100;
  return { days, rate, gross, tax, net };
}

export async function createPayrollRun(input: {
  projectId: string;
  userId: string;
  label?: string | null;
  periodStart: string | Date;
  periodEnd: string | Date;
  lines?: PayrollLineDraft[];
}) {
  const lines = input.lines ?? [];
  const lineData = lines.map((l) => {
    const { days, rate, gross, tax, net } = computePayrollLine(l);
    return {
      personLabel: l.personLabel,
      role: l.role ?? null,
      department: l.department ?? null,
      shootDayId: l.shootDayId ?? null,
      castingInvitationId: l.castingInvitationId ?? null,
      crewInvitationId: l.crewInvitationId ?? null,
      daysWorked: days,
      dayRate: rate,
      grossAmount: gross,
      taxWithheld: tax,
      netAmount: net,
      unit: l.unit ?? null,
      notes: l.notes ?? null,
    };
  });

  const totalGross = lineData.reduce((s, l) => s + l.grossAmount, 0);
  const totalTax = lineData.reduce((s, l) => s + l.taxWithheld, 0);
  const totalNet = lineData.reduce((s, l) => s + l.netAmount, 0);

  return prisma.payrollRun.create({
    data: {
      projectId: input.projectId,
      label: input.label ?? null,
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
      createdById: input.userId,
      totalGross,
      totalTax,
      totalNet,
      lines: { create: lineData },
    },
    include: { lines: true },
  });
}

/** Build payroll lines from accepted cast/crew on shoot days in period. */
export async function generatePayrollFromSchedule(input: {
  projectId: string;
  userId: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  label?: string;
}) {
  const start = new Date(input.periodStart);
  const end = new Date(input.periodEnd);

  const shootDays = await prisma.shootDay.findMany({
    where: { projectId: input.projectId, date: { gte: start, lte: end } },
    select: { id: true, date: true, unit: true },
  });
  const dayIds = new Set(shootDays.map((d) => d.id));

  const [castingInvites, crewInvites] = await Promise.all([
    prisma.castingInvitation.findMany({
      where: { projectId: input.projectId, status: "ACCEPTED" },
      include: {
        role: { select: { name: true, dailyRate: true } },
        talent: { select: { name: true } },
        creator: { select: { name: true } },
      },
    }),
    prisma.crewInvitation.findMany({
      where: { projectId: input.projectId, status: "ACCEPTED" },
      include: {
        need: { select: { role: true, department: true, dailyRate: true } },
        crewMember: { select: { name: true } },
        creator: { select: { name: true } },
      },
    }),
  ]);

  const lines: PayrollLineDraft[] = [];

  for (const inv of castingInvites) {
    const name = inv.talent?.name ?? inv.creator.name ?? "Cast";
    const rate = inv.role.dailyRate ?? 0;
    for (const day of shootDays) {
      lines.push({
        personLabel: name,
        role: inv.role.name,
        department: "CAST",
        shootDayId: day.id,
        castingInvitationId: inv.id,
        daysWorked: 1,
        dayRate: rate,
        unit: day.unit,
      });
    }
  }

  for (const inv of crewInvites) {
    const name = inv.crewMember?.name ?? inv.creator.name ?? "Crew";
    const rate = inv.need.dailyRate ?? 0;
    for (const day of shootDays) {
      lines.push({
        personLabel: name,
        role: inv.need.role,
        department: inv.need.department ?? "CREW",
        shootDayId: day.id,
        crewInvitationId: inv.id,
        daysWorked: 1,
        dayRate: rate,
        unit: day.unit,
      });
    }
  }

  void dayIds;

  return createPayrollRun({
    projectId: input.projectId,
    userId: input.userId,
    label: input.label ?? `Payroll ${start.toISOString().slice(0, 10)} – ${end.toISOString().slice(0, 10)}`,
    periodStart: start,
    periodEnd: end,
    lines,
  });
}

export async function approvePayrollRun(projectId: string, runId: string, userId: string) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, projectId } });
  if (!run || !["DRAFT", "PENDING_APPROVAL"].includes(run.status)) {
    return { error: "Run not approvable" as const, run: null };
  }
  const updated = await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
    include: { lines: true },
  });
  return { error: null, run: updated };
}

export async function payPayrollRun(projectId: string, runId: string, userId: string) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, projectId },
    include: { lines: true },
  });
  if (!run || run.status !== "APPROVED") {
    return { error: "Run must be APPROVED before payment" as const, run: null };
  }

  for (const line of run.lines) {
    if (line.netAmount <= 0) continue;
    const existing = await prisma.productionExpense.findFirst({
      where: { payrollLineItemId: line.id },
    });
    if (existing) continue;

    const expense = await createProductionExpense({
      projectId,
      userId,
      amount: line.netAmount,
      title: `Payroll: ${line.personLabel}`,
      category: "PAYROLL",
      department: line.department ?? "PAYROLL",
      shootDayId: line.shootDayId,
      spentAt: new Date(),
      approvalStatus: "APPROVED",
      paymentStatus: "PAID",
      autoGeneratedFrom: `payroll_run:${runId}`,
    });

    await prisma.productionExpense.update({
      where: { id: expense.expense.id },
      data: { payrollLineItemId: line.id },
    });
  }

  const updated = await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: "PAID", paidAt: new Date() },
    include: { lines: true },
  });
  return { error: null, run: updated };
}
