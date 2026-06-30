import { prisma } from "@/lib/prisma";

export async function listPettyCashFunds(projectId: string) {
  return prisma.pettyCashFund.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      custodian: { select: { id: true, name: true, email: true } },
      _count: { select: { expenses: true } },
    },
  });
}

export async function createPettyCashFund(input: {
  projectId: string;
  custodianUserId: string;
  floatAmount: number;
  name?: string;
  lowBalanceThreshold?: number | null;
}) {
  return prisma.pettyCashFund.create({
    data: {
      projectId: input.projectId,
      custodianUserId: input.custodianUserId,
      name: input.name ?? "Petty cash",
      floatAmount: input.floatAmount,
      balance: input.floatAmount,
      lowBalanceThreshold: input.lowBalanceThreshold ?? input.floatAmount * 0.2,
    },
    include: { custodian: { select: { id: true, name: true } } },
  });
}

export async function deductPettyCash(fundId: string, amount: number) {
  const fund = await prisma.pettyCashFund.findUnique({ where: { id: fundId } });
  if (!fund || fund.status !== "ACTIVE") return { error: "Fund not active" as const };
  if (fund.balance < amount) return { error: "Insufficient petty cash balance" as const };

  const updated = await prisma.pettyCashFund.update({
    where: { id: fundId },
    data: { balance: Math.round((fund.balance - amount) * 100) / 100 },
  });
  return { error: null, fund: updated, lowBalance: updated.balance <= (updated.lowBalanceThreshold ?? 0) };
}

export async function replenishPettyCash(fundId: string, amount: number) {
  const fund = await prisma.pettyCashFund.findUnique({ where: { id: fundId } });
  if (!fund) return null;
  return prisma.pettyCashFund.update({
    where: { id: fundId },
    data: { balance: Math.min(fund.floatAmount, fund.balance + amount) },
  });
}

export async function pettyCashSummary(projectId: string) {
  const funds = await listPettyCashFunds(projectId);
  return {
    totalFloat: funds.reduce((s, f) => s + f.floatAmount, 0),
    totalBalance: funds.reduce((s, f) => s + f.balance, 0),
    lowBalanceFunds: funds.filter((f) => f.balance <= (f.lowBalanceThreshold ?? 0)).length,
    funds,
  };
}
