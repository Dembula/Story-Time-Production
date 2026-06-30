import "server-only";

import { prisma } from "@/lib/prisma";

/** Proactive alerts surfaced to the VA for creator scope. */
export async function buildProactiveIntelligenceBlock(
  userId: string,
  projectId: string | null,
): Promise<string> {
  if (!projectId) return "";

  const [contracts, expenses, budget, shootDays, tasks] = await Promise.all([
    prisma.projectContract.findMany({
      where: { projectId },
      select: { id: true, subject: true, status: true, signatureDeadline: true },
    }),
    prisma.productionExpense.findMany({
      where: { projectId },
      select: { amount: true, description: true },
      take: 200,
    }),
    prisma.projectBudget.findUnique({
      where: { projectId },
      select: { totalPlanned: true },
    }),
    prisma.shootDay.findMany({
      where: { projectId, date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 3,
      select: { id: true, date: true },
    }),
    prisma.projectTask.findMany({
      where: { projectId, status: { in: ["TODO", "BLOCKED"] } },
      take: 10,
      select: { id: true, title: true, status: true },
    }),
  ]);

  const alerts: string[] = [];
  const now = Date.now();
  const weekMs = 7 * 86400000;

  const unsigned = contracts.filter((c) =>
    ["SENT", "VIEWED", "PARTIALLY_SIGNED", "AWAITING_SIGNATURE", "CHANGES_REQUESTED"].includes(c.status),
  );
  if (unsigned.length > 0) {
    alerts.push(
      `${unsigned.length} contract(s) awaiting signature (e.g. "${unsigned[0]?.subject ?? unsigned[0]?.id}").`,
    );
  }

  for (const c of contracts) {
    if (c.signatureDeadline) {
      const due = c.signatureDeadline.getTime();
      if (due > now && due - now < weekMs) {
        alerts.push(`Contract "${c.subject ?? c.id}" signature deadline within 7 days.`);
      }
    }
  }

  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);
  const planned = budget?.totalPlanned ?? 0;
  if (planned > 0 && totalSpend > planned) {
    alerts.push(
      `Spend R${Math.round(totalSpend).toLocaleString()} exceeds budget R${Math.round(planned).toLocaleString()}.`,
    );
  }

  if (shootDays[0]) {
    alerts.push(`Next shoot day: ${shootDays[0].date.toISOString().slice(0, 10)}.`);
  }

  const blocked = tasks.filter((t) => t.status === "BLOCKED");
  if (blocked.length > 0) {
    alerts.push(`${blocked.length} blocked task(s) on this project.`);
  }

  if (alerts.length === 0) return "";

  return `## Proactive intelligence (mention only if relevant — max 1–2 per reply)
${alerts.map((a) => `- ${a}`).join("\n")}`;
}
