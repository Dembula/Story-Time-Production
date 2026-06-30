import { prisma } from "@/lib/prisma";

export async function getLegalAnalytics(projectId: string) {
  const contracts = await prisma.projectContract.findMany({
    where: { projectId },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      signatures: true,
      approvalSteps: true,
      signers: true,
    },
  });

  const now = Date.now();
  const byStatus: Record<string, number> = {};
  let cycleTimes: number[] = [];
  let rejections = 0;
  let overdue = 0;
  let pendingApprovals = 0;
  let pendingSignatures = 0;

  for (const c of contracts) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    if (c.status === "REJECTED") rejections++;
    if (c.signatureDeadline && c.signatureDeadline.getTime() < now && !["EXECUTED", "COMPLETED", "CANCELLED"].includes(c.status)) {
      overdue++;
    }
    pendingApprovals += c.approvalSteps.filter((s) => s.status === "PENDING").length;
    pendingSignatures += c.signers.filter((s) => s.required && s.status === "PENDING").length;

    const sent = c.sentAt ?? c.events.find((e) => e.eventType === "SENT")?.createdAt;
    const executed = c.executedAt ?? c.events.find((e) => e.eventType === "EXECUTED")?.createdAt;
    if (sent && executed) {
      cycleTimes.push(executed.getTime() - sent.getTime());
    }
  }

  const avgCycleDays =
    cycleTimes.length > 0 ?
      Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length / 86400000)
    : null;

  return {
    total: contracts.length,
    byStatus,
    signed: contracts.filter((c) => ["EXECUTED", "COMPLETED"].includes(c.status)).length,
    rejectionRate: contracts.length ? rejections / contracts.length : 0,
    overdue,
    pendingApprovals,
    pendingSignatures,
    avgCycleDays,
    blockingSchedule: contracts.filter((c) =>
      ["SENT", "VIEWED", "CHANGES_REQUESTED", "PARTIALLY_SIGNED", "AWAITING_SIGNATURE"].includes(c.status),
    ).length,
  };
}
