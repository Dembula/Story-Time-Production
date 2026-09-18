import { prisma } from "@/lib/prisma";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { ensureWalletForUser } from "@/lib/payments/wallet";

const db = prisma as any;

const VENDOR_ROLES = [
  "CREW_TEAM",
  "CASTING_AGENCY",
  "LOCATION_OWNER",
  "EQUIPMENT_COMPANY",
  "CATERING_COMPANY",
  "CONTENT_CREATOR",
] as const;

const OPEN_PAYOUT_STATUSES = ["PENDING_REVIEW", "APPROVED", "PROCESSING"] as const;

/**
 * Move marketplace vendor pending balances to available for monthly payout eligibility.
 * Never releases funds held for open withdrawal requests (AVAILABLE → PENDING holds).
 */
export async function releaseDueMarketplaceVendorBalances() {
  const vendors = await db.user.findMany({
    where: {
      role: { in: [...VENDOR_ROLES] },
      wallet: { pendingBalance: { gt: 0 } },
    },
    select: {
      id: true,
      wallet: { select: { id: true, pendingBalance: true } },
    },
    take: 500,
  });

  let released = 0;
  const period = new Date().toISOString().slice(0, 7);

  for (const vendor of vendors) {
    const pending = Number(vendor.wallet?.pendingBalance ?? 0);
    if (pending <= 0) continue;

    const openPayouts = await db.payoutRequest.aggregate({
      where: {
        userId: vendor.id,
        status: { in: [...OPEN_PAYOUT_STATUSES] },
      },
      _sum: { amount: true },
    });
    const heldForWithdrawal = Number(openPayouts._sum?.amount ?? 0);
    const releasable = Math.round((pending - heldForWithdrawal) * 100) / 100;
    if (releasable <= 0) continue;

    await ensureWalletForUser(vendor.id);
    await postBalancedLedgerBatch({
      idempotencyKey: `marketplace_vendor_release_${vendor.id}_${period}`,
      referenceType: "MARKETPLACE_VENDOR_PAYOUT",
      referenceId: vendor.id,
      metadata: {
        period,
        source: "monthly_vendor_release",
        pendingBefore: pending,
        heldForWithdrawal,
        releasable,
      },
      entries: [
        {
          userId: vendor.id,
          direction: "DEBIT",
          accountType: "PENDING",
          transactionType: "marketplace_vendor_release",
          amount: releasable,
          description: `Marketplace earnings released for ${period}`,
        },
        {
          userId: vendor.id,
          direction: "CREDIT",
          accountType: "AVAILABLE",
          transactionType: "marketplace_vendor_release",
          amount: releasable,
          description: `Available for withdrawal — ${period}`,
        },
      ],
    });
    released += 1;
  }

  return { vendorsReleased: released };
}
