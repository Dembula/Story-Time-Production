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

/** Move marketplace vendor pending balances to available for monthly payout eligibility. */
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
    const pending = vendor.wallet?.pendingBalance ?? 0;
    if (pending <= 0) continue;
    await ensureWalletForUser(vendor.id);
    await postBalancedLedgerBatch({
      idempotencyKey: `marketplace_vendor_release_${vendor.id}_${period}`,
      referenceType: "MARKETPLACE_VENDOR_PAYOUT",
      referenceId: vendor.id,
      metadata: { period, source: "monthly_vendor_release" },
      entries: [
        {
          userId: vendor.id,
          direction: "DEBIT",
          accountType: "PENDING",
          transactionType: "marketplace_vendor_release",
          amount: pending,
          description: `Marketplace earnings released for ${period}`,
        },
        {
          userId: vendor.id,
          direction: "CREDIT",
          accountType: "AVAILABLE",
          transactionType: "marketplace_vendor_release",
          amount: pending,
          description: `Available for withdrawal — ${period}`,
        },
      ],
    });
    released += 1;
  }

  return { vendorsReleased: released };
}
