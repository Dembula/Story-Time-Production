import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/funders";

export async function GET() {
  const access = await requireSessionUser();
  if (access.error) return access.error;

  const [deals, revenueEvents, payouts] = await Promise.all([
    prisma.investmentDeal.findMany({
      where: { funderUserId: access.userId! },
      include: { opportunity: true, payments: true, capTableEntries: true, project: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.projectRevenueEvent.findMany({
      where: { project: { investmentDeals: { some: { funderUserId: access.userId! } } } },
      orderBy: { receivedAt: "desc" },
      take: 200,
    }),
    prisma.stakeholderPayout.findMany({
      where: { userId: access.userId! },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const invested = deals.reduce((sum, d) => sum + d.payments.reduce((acc, p) => acc + p.amount, 0), 0);
  const paidOut = payouts.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const pendingPayout = payouts.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + p.amount, 0);
  const roiPct = invested > 0 ? ((paidOut - invested) / invested) * 100 : 0;

  return NextResponse.json({
    deals,
    revenueEvents,
    payouts,
    metrics: {
      invested,
      paidOut,
      pendingPayout,
      roiPct,
      activeDeals: deals.filter((d) => !["REJECTED", "FUNDED"].includes(d.pipelineStatus)).length,
      fundedDeals: deals.filter((d) => d.pipelineStatus === "FUNDED").length,
    },
  });
}
