import "server-only";

import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/payments/config";
import { getPlatformTreasuryUserId } from "@/lib/payments/treasury-inflow";

const db = prisma as any;

export type CreatorUnpaidRow = {
  userId: string;
  name: string | null;
  email: string | null;
  availableBalance: number;
  pendingBalance: number;
  totalOwed: number;
  lastEarningsAt: string | null;
  openPayoutStatus: string | null;
  openPayoutAmount: number | null;
};

export type CreatorUnpaidLiabilityBundle = {
  asOf: string;
  availableTotal: number;
  pendingTotal: number;
  owedTotal: number;
  creatorCount: number;
  rows: CreatorUnpaidRow[];
};

/**
 * Stock (not period-scoped): creator wallets still sitting unpaid after pool distribution.
 * Excludes the platform treasury wallet.
 */
export async function fetchCreatorUnpaidLiability(limit = 25): Promise<CreatorUnpaidLiabilityBundle> {
  const asOf = new Date().toISOString();
  let treasuryUserId: string | null = null;
  try {
    treasuryUserId = await getPlatformTreasuryUserId();
  } catch {
    treasuryUserId = null;
  }

  const wallets = await db.wallet.findMany({
    where: {
      user: { role: { in: ["CONTENT_CREATOR", "MUSIC_CREATOR"] } },
      ...(treasuryUserId ? { userId: { not: treasuryUserId } } : {}),
      OR: [{ availableBalance: { gt: 0 } }, { pendingBalance: { gt: 0 } }],
    },
    select: {
      userId: true,
      availableBalance: true,
      pendingBalance: true,
      user: { select: { id: true, name: true, email: true } },
      payoutRequests: {
        where: { status: { in: ["PENDING_REVIEW", "APPROVED", "PROCESSING"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, amount: true },
      },
    },
    orderBy: [{ availableBalance: "desc" }, { pendingBalance: "desc" }],
    take: Math.min(100, Math.max(5, limit)),
  });

  const userIds = wallets.map((w: { userId: string }) => w.userId);
  const lastCredits =
    userIds.length === 0
      ? []
      : await db.ledgerEntry.findMany({
          where: {
            userId: { in: userIds },
            transactionType: "creator_earnings",
            direction: "CREDIT",
            accountType: "AVAILABLE",
          },
          orderBy: { createdAt: "desc" },
          distinct: ["userId"],
          select: { userId: true, createdAt: true },
        });

  const lastByUser = new Map<string, Date>(
    lastCredits.map((row: { userId: string; createdAt: Date }) => [row.userId, row.createdAt]),
  );

  let availableTotal = 0;
  let pendingTotal = 0;
  const rows: CreatorUnpaidRow[] = wallets.map(
    (w: {
      userId: string;
      availableBalance: number;
      pendingBalance: number;
      user: { name: string | null; email: string | null } | null;
      payoutRequests: Array<{ status: string; amount: number }>;
    }) => {
      const available = roundMoney(Number(w.availableBalance) || 0);
      const pending = roundMoney(Number(w.pendingBalance) || 0);
      availableTotal += available;
      pendingTotal += pending;
      const open = w.payoutRequests[0] ?? null;
      const last = lastByUser.get(w.userId) ?? null;
      return {
        userId: w.userId,
        name: w.user?.name ?? null,
        email: w.user?.email ?? null,
        availableBalance: available,
        pendingBalance: pending,
        totalOwed: roundMoney(available + pending),
        lastEarningsAt: last ? last.toISOString() : null,
        openPayoutStatus: open?.status ?? null,
        openPayoutAmount: open ? roundMoney(Number(open.amount) || 0) : null,
      };
    },
  );

  // Full totals across all matching creators (not just the table page).
  const agg = await db.wallet.aggregate({
    where: {
      user: { role: { in: ["CONTENT_CREATOR", "MUSIC_CREATOR"] } },
      ...(treasuryUserId ? { userId: { not: treasuryUserId } } : {}),
    },
    _sum: { availableBalance: true, pendingBalance: true },
    _count: { _all: true },
  });

  const availableAll = roundMoney(Number(agg._sum?.availableBalance ?? 0));
  const pendingAll = roundMoney(Number(agg._sum?.pendingBalance ?? 0));

  const owedCreators = await db.wallet.count({
    where: {
      user: { role: { in: ["CONTENT_CREATOR", "MUSIC_CREATOR"] } },
      ...(treasuryUserId ? { userId: { not: treasuryUserId } } : {}),
      OR: [{ availableBalance: { gt: 0 } }, { pendingBalance: { gt: 0 } }],
    },
  });

  return {
    asOf,
    availableTotal: availableAll,
    pendingTotal: pendingAll,
    owedTotal: roundMoney(availableAll + pendingAll),
    creatorCount: owedCreators,
    rows,
  };
}
