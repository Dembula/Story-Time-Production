import { prisma } from "@/lib/prisma";

export async function getFunderBloombergAnalytics(userId: string) {
  const [deals, payouts] = await Promise.all([
    prisma.investmentDeal.findMany({
      where: { funderUserId: userId },
      orderBy: { updatedAt: "asc" },
      include: { opportunity: { select: { title: true } }, payments: true },
    }),
    prisma.stakeholderPayout.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  const dealInvested = (d: (typeof deals)[0]) => d.payments.reduce((s, p) => s + p.amount, 0);
  const invested = deals.reduce((s, d) => s + dealInvested(d), 0);
  const paidOut = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);

  const monthlySeries: { month: string; invested: number; paidOut: number; deals: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthDeals = deals.filter((deal) => {
      const m = deal.createdAt;
      return m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth();
    });
    const monthPayouts = payouts.filter((p) => {
      const m = p.createdAt;
      return m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth() && p.status === "PAID";
    });
    monthlySeries.push({
      month: key,
      invested: monthDeals.reduce((s, x) => s + dealInvested(x), 0),
      paidOut: monthPayouts.reduce((s, x) => s + x.amount, 0),
      deals: monthDeals.length,
    });
  }

  const pipelineByStatus: Record<string, number> = {};
  for (const d of deals) {
    pipelineByStatus[d.pipelineStatus] = (pipelineByStatus[d.pipelineStatus] ?? 0) + 1;
  }

  const roiPct = invested > 0 ? ((paidOut - invested) / invested) * 100 : 0;

  return {
    headline: {
      invested,
      paidOut,
      roiPct,
      activeDeals: deals.filter((d) => !["REJECTED", "FUNDED"].includes(d.pipelineStatus)).length,
    },
    monthlySeries,
    pipelineByStatus,
    topDeals: deals.slice(-8).reverse().map((d) => ({
      id: d.id,
      title: d.opportunity.title,
      status: d.pipelineStatus,
      committed: dealInvested(d),
    })),
  };
}
