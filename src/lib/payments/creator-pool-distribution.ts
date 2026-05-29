import { prisma } from "@/lib/prisma";
import { VIEWER_CREATOR_SPLIT, roundMoney } from "@/lib/payments/config";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { getCreatorRevenue, getViewerSubscriptionRevenue } from "@/lib/revenue";
import { getPlatformTreasuryUserId } from "@/lib/payments/treasury-inflow";

const db = prisma as any;

export function formatRevenuePeriodKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getCalendarMonthRange(year: number, monthIndex: number): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const periodEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return { periodStart, periodEnd };
}

export function getPreviousCalendarMonthRange(now = new Date()): {
  periodStart: Date;
  periodEnd: Date;
  periodKey: string;
} {
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const monthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const { periodStart, periodEnd } = getCalendarMonthRange(year, monthIndex);
  return { periodStart, periodEnd, periodKey: formatRevenuePeriodKey(periodStart) };
}

function allocateByWatchShare(
  creatorPool: number,
  rows: { creatorId: string; watchTime: number }[],
): { creatorId: string; amount: number; watchTime: number; share: number }[] {
  const eligible = rows.filter((row) => row.watchTime > 0);
  const totalWatchTime = eligible.reduce((sum, row) => sum + row.watchTime, 0);
  if (creatorPool <= 0 || totalWatchTime <= 0 || eligible.length === 0) return [];

  const provisional = eligible.map((row) => {
    const share = row.watchTime / totalWatchTime;
    const raw = creatorPool * share;
    const amount = Math.floor(raw * 100) / 100;
    return { creatorId: row.creatorId, watchTime: row.watchTime, share, amount, remainder: raw - amount };
  });

  let distributed = roundMoney(provisional.reduce((sum, row) => sum + row.amount, 0));
  let centsLeft = Math.round((creatorPool - distributed) * 100);
  const byRemainder = [...provisional].sort((a, b) => b.remainder - a.remainder);
  let index = 0;
  while (centsLeft > 0 && byRemainder.length > 0) {
    byRemainder[index % byRemainder.length].amount = roundMoney(byRemainder[index % byRemainder.length].amount + 0.01);
    centsLeft -= 1;
    index += 1;
  }

  return byRemainder
    .map(({ creatorId, watchTime, share, amount }) => ({
      creatorId,
      watchTime,
      share: roundMoney(share * 10000) / 100,
      amount,
    }))
    .filter((row) => row.amount > 0);
}

export async function hasCreatorPoolDistribution(periodKey: string): Promise<boolean> {
  const payout = await db.creatorPayout.findFirst({
    where: { period: periodKey, bankReference: { startsWith: "pool:" } },
    select: { id: true },
  });
  return Boolean(payout);
}

export type CreatorPoolDistributionResult = {
  ok: boolean;
  periodKey: string;
  skipped?: boolean;
  reason?: string;
  viewerSubRevenue?: number;
  creatorPool?: number;
  storyTimeRetained?: number;
  creatorsPaid?: number;
  totalDistributed?: number;
  allocations?: { creatorId: string; amount: number; share: number; watchTime: number }[];
};

export async function distributeCreatorPoolForPeriod(
  periodStart: Date,
  periodEnd: Date,
): Promise<CreatorPoolDistributionResult> {
  const periodKey = formatRevenuePeriodKey(periodStart);

  if (await hasCreatorPoolDistribution(periodKey)) {
    return { ok: true, skipped: true, periodKey, reason: "already_distributed" };
  }

  const viewerSubRevenue = await getViewerSubscriptionRevenue(periodStart, periodEnd);
  const creatorPool = roundMoney(viewerSubRevenue * VIEWER_CREATOR_SPLIT);
  const storyTimeRetained = roundMoney(viewerSubRevenue - creatorPool);

  if (viewerSubRevenue <= 0) {
    return { ok: true, skipped: true, periodKey, reason: "no_viewer_subscription_revenue" };
  }

  if (creatorPool <= 0) {
    return { ok: true, skipped: true, periodKey, reason: "empty_creator_pool" };
  }

  const creators = await db.user.findMany({
    where: { role: { in: ["CONTENT_CREATOR", "MUSIC_CREATOR"] } },
    select: { id: true },
  });

  const watchRows = await Promise.all(
    creators.map(async (creator: { id: string }) => {
      const stats = await getCreatorRevenue(creator.id, periodStart, periodEnd);
      return { creatorId: creator.id, watchTime: stats.watchTime };
    }),
  );

  const allocations = allocateByWatchShare(creatorPool, watchRows);
  if (allocations.length === 0) {
    return { ok: true, skipped: true, periodKey, reason: "no_watch_time", viewerSubRevenue, creatorPool };
  }

  const treasuryUserId = await getPlatformTreasuryUserId();
  await ensureWalletForUser(treasuryUserId);

  const treasuryWallet = await db.wallet.findUnique({
    where: { userId: treasuryUserId },
    select: { availableBalance: true },
  });
  const totalDistributed = roundMoney(allocations.reduce((sum, row) => sum + row.amount, 0));
  const treasuryAvailable = Number(treasuryWallet?.availableBalance ?? 0);
  if (treasuryAvailable + 0.001 < totalDistributed) {
    return {
      ok: false,
      periodKey,
      reason: "insufficient_treasury_balance",
      viewerSubRevenue,
      creatorPool,
      totalDistributed,
    };
  }

  for (const allocation of allocations) {
    await ensureWalletForUser(allocation.creatorId);
    await postBalancedLedgerBatch({
      idempotencyKey: `creator_pool_dist_${periodKey}_${allocation.creatorId}`,
      referenceType: "CREATOR_POOL_DISTRIBUTION",
      referenceId: `${periodKey}:${allocation.creatorId}`,
      metadata: {
        periodKey,
        watchTime: allocation.watchTime,
        share: allocation.share,
        viewerSubRevenue,
        creatorPool,
      },
      entries: [
        {
          userId: treasuryUserId,
          direction: "DEBIT",
          accountType: "AVAILABLE",
          transactionType: "creator_pool_payout",
          amount: allocation.amount,
          description: `Creator pool ${periodKey}`,
        },
        {
          userId: allocation.creatorId,
          direction: "CREDIT",
          accountType: "AVAILABLE",
          transactionType: "creator_earnings",
          amount: allocation.amount,
          description: `Viewer subscription pool ${periodKey}`,
        },
      ],
    });

    await db.creatorPayout.create({
      data: {
        creatorId: allocation.creatorId,
        amount: allocation.amount,
        currency: "ZAR",
        status: "COMPLETED",
        period: periodKey,
        paidAt: new Date(),
        bankReference: `pool:${periodKey}`,
      },
    });
  }

  const existingPlatformRevenue = await prisma.platformRevenue.findFirst({
    where: { period: periodKey },
    select: { id: true },
  });
  if (existingPlatformRevenue) {
    await prisma.platformRevenue.update({
      where: { id: existingPlatformRevenue.id },
      data: { amount: viewerSubRevenue },
    });
  } else {
    await prisma.platformRevenue.create({
      data: { period: periodKey, amount: viewerSubRevenue },
    });
  }

  return {
    ok: true,
    periodKey,
    viewerSubRevenue,
    creatorPool,
    storyTimeRetained,
    creatorsPaid: allocations.length,
    totalDistributed,
    allocations,
  };
}

export async function runDueCreatorPoolDistributions(now = new Date()): Promise<CreatorPoolDistributionResult[]> {
  const { periodStart, periodEnd } = getPreviousCalendarMonthRange(now);
  const result = await distributeCreatorPoolForPeriod(periodStart, periodEnd);
  return [result];
}
