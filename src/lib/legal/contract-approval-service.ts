import { prisma } from "@/lib/prisma";
import { logContractEvent } from "@/lib/contract-lifecycle";

export type ApprovalStepInput = {
  approverUserId?: string | null;
  approverRole?: string | null;
};

export async function listApprovalSteps(contractId: string) {
  return prisma.contractApprovalStep.findMany({
    where: { contractId },
    orderBy: { stepOrder: "asc" },
    include: { approver: { select: { id: true, name: true, email: true } } },
  });
}

export async function replaceApprovalChain(contractId: string, steps: ApprovalStepInput[]) {
  await prisma.$transaction([
    prisma.contractApprovalStep.deleteMany({ where: { contractId } }),
    ...steps.map((s, i) =>
      prisma.contractApprovalStep.create({
        data: {
          contractId,
          stepOrder: i + 1,
          approverUserId: s.approverUserId ?? null,
          approverRole: s.approverRole ?? null,
          status: "PENDING",
        },
      }),
    ),
  ]);
  await prisma.projectContract.update({
    where: { id: contractId },
    data: {
      approvalRequired: steps.length > 0,
      ...(steps.length > 0 ? { status: "INTERNAL_APPROVAL" } : {}),
    },
  });
  return listApprovalSteps(contractId);
}

export async function decideApprovalStep(input: {
  contractId: string;
  stepId: string;
  userId: string;
  decision: "APPROVED" | "REJECTED";
  comment?: string | null;
}) {
  const step = await prisma.contractApprovalStep.findFirst({
    where: { id: input.stepId, contractId: input.contractId },
  });
  if (!step) return { error: "Step not found" as const };
  if (step.approverUserId && step.approverUserId !== input.userId) {
    return { error: "Not assigned approver" as const };
  }
  if (step.status !== "PENDING") return { error: "Step already decided" as const };

  await prisma.contractApprovalStep.update({
    where: { id: step.id },
    data: {
      status: input.decision,
      comment: input.comment ?? null,
      decidedAt: new Date(),
    },
  });

  await logContractEvent(input.contractId, `APPROVAL_${input.decision}`, {
    userId: input.userId,
    detail: input.comment ?? undefined,
    metadata: { stepId: step.id, stepOrder: step.stepOrder },
  });

  if (input.decision === "REJECTED") {
    await prisma.projectContract.update({
      where: { id: input.contractId },
      data: { status: "DRAFT" },
    });
    return { error: null, status: "REJECTED" as const };
  }

  const pending = await prisma.contractApprovalStep.count({
    where: { contractId: input.contractId, status: "PENDING" },
  });
  if (pending === 0) {
    await prisma.projectContract.update({
      where: { id: input.contractId },
      data: { status: "READY_TO_SEND" },
    });
    return { error: null, status: "READY_TO_SEND" as const };
  }
  return { error: null, status: "INTERNAL_APPROVAL" as const };
}

export async function defaultContractApprovalChain(projectId: string, contractId: string) {
  const members = await prisma.originalMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true } } },
    take: 2,
  });
  if (members.length === 0) return [];
  return replaceApprovalChain(
    contractId,
    members.map((m, i) => ({
      approverUserId: m.userId,
      approverRole: i === 0 ? "PRODUCER" : "LEGAL",
    })),
  );
}

export async function assertApprovalsComplete(contractId: string) {
  const contract = await prisma.projectContract.findUnique({ where: { id: contractId } });
  if (!contract?.approvalRequired) return { ok: true as const };
  const pending = await prisma.contractApprovalStep.count({
    where: { contractId, status: "PENDING" },
  });
  if (pending > 0) return { ok: false as const, reason: "Approval chain incomplete" };
  return { ok: true as const };
}
