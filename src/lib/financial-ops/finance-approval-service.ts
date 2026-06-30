import { prisma } from "@/lib/prisma";

export type FinanceEntityType = "EXPENSE" | "PO" | "PAYROLL";

export type ApprovalStepInput = {
  approverUserId?: string | null;
  approverRole?: string | null;
};

export async function listFinanceApprovalSteps(entityType: FinanceEntityType, entityId: string) {
  return prisma.financeApprovalStep.findMany({
    where: { entityType, entityId },
    orderBy: { stepOrder: "asc" },
    include: { approver: { select: { id: true, name: true, email: true } } },
  });
}

export async function replaceFinanceApprovalChain(
  entityType: FinanceEntityType,
  entityId: string,
  steps: ApprovalStepInput[],
) {
  await prisma.$transaction([
    prisma.financeApprovalStep.deleteMany({ where: { entityType, entityId } }),
    ...steps.map((s, i) =>
      prisma.financeApprovalStep.create({
        data: {
          entityType,
          entityId,
          stepOrder: i + 1,
          approverUserId: s.approverUserId ?? null,
          approverRole: s.approverRole ?? null,
          status: "PENDING",
        },
      }),
    ),
  ]);
  return listFinanceApprovalSteps(entityType, entityId);
}

export async function decideFinanceApprovalStep(input: {
  entityType: FinanceEntityType;
  entityId: string;
  stepId: string;
  userId: string;
  decision: "APPROVED" | "REJECTED";
  comment?: string | null;
}) {
  const step = await prisma.financeApprovalStep.findFirst({
    where: { id: input.stepId, entityType: input.entityType, entityId: input.entityId },
  });
  if (!step) return { error: "Step not found" as const };
  if (step.approverUserId && step.approverUserId !== input.userId) {
    return { error: "Not assigned approver" as const };
  }
  if (step.status !== "PENDING") return { error: "Step already decided" as const };

  await prisma.financeApprovalStep.update({
    where: { id: step.id },
    data: {
      status: input.decision,
      comment: input.comment ?? null,
      decidedAt: new Date(),
    },
  });

  if (input.decision === "REJECTED") {
    return { error: null, complete: false, rejected: true as const };
  }

  const pending = await prisma.financeApprovalStep.count({
    where: { entityType: input.entityType, entityId: input.entityId, status: "PENDING" },
  });
  return { error: null, complete: pending === 0, rejected: false as const };
}

export async function assertFinanceApprovalsComplete(entityType: FinanceEntityType, entityId: string) {
  const steps = await prisma.financeApprovalStep.count({ where: { entityType, entityId } });
  if (steps === 0) return { ok: true as const };
  const pending = await prisma.financeApprovalStep.count({
    where: { entityType, entityId, status: "PENDING" },
  });
  if (pending > 0) return { ok: false as const, reason: "Approval chain incomplete" };
  return { ok: true as const };
}

export async function defaultExpenseApprovalChain(projectId: string, expenseId: string) {
  const members = await prisma.originalMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true } } },
    take: 2,
  });
  if (members.length === 0) return [];
  return replaceFinanceApprovalChain(
    "EXPENSE",
    expenseId,
    members.map((m, i) => ({
      approverUserId: m.userId,
      approverRole: i === 0 ? "PRODUCER" : "FINANCE",
    })),
  );
}
