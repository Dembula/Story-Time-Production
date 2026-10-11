import "server-only";

import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/payments/config";
import { getPlatformTreasuryUserId } from "@/lib/payments/treasury-inflow";
import { computeCreatorFacingBalances } from "@/lib/payments/creator-wallet-view";

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
 * Uses creator-facing earnings only — excludes platform treasury balances that were
 * historically mis-posted onto creator userIds.
 */
export async function fetchCreatorUnpaidLiability(limit = 25): Promise<CreatorUnpaidLiabilityBundle> {
  const asOf = new Date().toISOString();
  let treasuryUserId: string | null = null;
  try {
    treasuryUserId = await getPlatformTreasuryUserId();
  } catch {
    treasuryUserId = null;
  }

  const creators = await db.user.findMany({
    where: {
      role: { in: ["CONTENT_CREATOR", "MUSIC_CREATOR"] },
      ...(treasuryUserId ? { id: { not: treasuryUserId } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      wallet: {
        select: {
          payoutRequests: {
            where: { status: { in: ["PENDING_REVIEW", "APPROVED", "PROCESSING"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true, amount: true },
          },
        },
      },
    },
  });

  const lastCredits =
    creators.length === 0
      ? []
      : await db.ledgerEntry.findMany({
          where: {
            userId: { in: creators.map((c: { id: string }) => c.id) },
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

  const facingByUser = new Map<string, Awaited<ReturnType<typeof computeCreatorFacingBalances>>>();
  await Promise.all(
    creators.map(async (creator: { id: string }) => {
      facingByUser.set(creator.id, await computeCreatorFacingBalances(creator.id));
    }),
  );

  let availableAll = 0;
  let pendingAll = 0;
  const owedRows: CreatorUnpaidRow[] = [];

  for (const creator of creators as Array<{
    id: string;
    name: string | null;
    email: string | null;
    wallet: { payoutRequests: Array<{ status: string; amount: number }> } | null;
  }>) {
    const facing = facingByUser.get(creator.id);
    if (!facing) continue;
    const available = facing.availableBalance;
    const pending = facing.pendingBalance;
    if (available <= 0.001 && pending <= 0.001) continue;

    availableAll = roundMoney(availableAll + available);
    pendingAll = roundMoney(pendingAll + pending);
    const open = creator.wallet?.payoutRequests?.[0] ?? null;
    const last = lastByUser.get(creator.id) ?? null;
    owedRows.push({
      userId: creator.id,
      name: creator.name,
      email: creator.email,
      availableBalance: available,
      pendingBalance: pending,
      totalOwed: roundMoney(available + pending),
      lastEarningsAt: last ? last.toISOString() : null,
      openPayoutStatus: open?.status ?? null,
      openPayoutAmount: open ? roundMoney(Number(open.amount) || 0) : null,
    });
  }

  owedRows.sort((a, b) => b.totalOwed - a.totalOwed);

  return {
    asOf,
    availableTotal: availableAll,
    pendingTotal: pendingAll,
    owedTotal: roundMoney(availableAll + pendingAll),
    creatorCount: owedRows.length,
    rows: owedRows.slice(0, Math.min(100, Math.max(5, limit))),
  };
}
