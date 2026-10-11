import "server-only";

import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/payments/config";

const db = prisma as any;

/** Ledger types that belong on the platform treasury — never creator personal earnings. */
export const TREASURY_LEDGER_TYPES = new Set([
  "incoming_payment",
  "gateway_balance",
  "viewer_creator_pool",
  "viewer_platform_share",
  "viewer_platform_hold_while_paused",
  "creator_pool_payout",
  "creator_pool_balance",
  "manual_payout",
  "manual_payout_balance",
  "platform_fee",
]);

/** Ledger types a creator (or music creator) should see on their wallet. */
export const CREATOR_FACING_LEDGER_TYPES = new Set([
  "creator_earnings",
  "withdrawal_hold",
  "withdrawal_completed",
  "withdrawal_declined",
  "withdrawal_released",
  "marketplace_vendor_release",
  "funding_deal_release",
  "sync_licensing_release",
]);

export function isCreatorWalletRole(role: string | null | undefined): boolean {
  return role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR";
}

export function isTreasuryLedgerType(transactionType: string | null | undefined): boolean {
  return Boolean(transactionType && TREASURY_LEDGER_TYPES.has(transactionType));
}

export function isCreatorFacingLedgerType(transactionType: string | null | undefined): boolean {
  return Boolean(transactionType && CREATOR_FACING_LEDGER_TYPES.has(transactionType));
}

export type CreatorFacingBalances = {
  availableBalance: number;
  pendingBalance: number;
  lockedBalance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  /** True when this wallet also holds platform treasury postings (legacy mis-routing). */
  hasTreasuryContamination: boolean;
};

/**
 * Recompute what a content/music creator should see: pool earnings + payouts only.
 * Ignores gateway / pool-treasury / platform-fee noise that may have landed on the same userId
 * when that account was previously used as treasury.
 */
export async function computeCreatorFacingBalances(userId: string): Promise<CreatorFacingBalances> {
  const entries = await db.ledgerEntry.findMany({
    where: { userId },
    select: {
      direction: true,
      accountType: true,
      transactionType: true,
      amount: true,
    },
  });

  let available = 0;
  let pending = 0;
  let locked = 0;
  let totalEarnings = 0;
  let totalWithdrawn = 0;
  let hasTreasuryContamination = false;

  for (const entry of entries as Array<{
    direction: string;
    accountType: string;
    transactionType: string;
    amount: number;
  }>) {
    if (isTreasuryLedgerType(entry.transactionType)) {
      hasTreasuryContamination = true;
      continue;
    }
    if (!isCreatorFacingLedgerType(entry.transactionType)) {
      // Unknown / escrow types: only count real LOCKED escrow if present.
      if (entry.accountType === "LOCKED") {
        const delta = entry.direction === "CREDIT" ? entry.amount : -entry.amount;
        locked = roundMoney(locked + delta);
      }
      continue;
    }

    const signed = entry.direction === "CREDIT" ? entry.amount : -entry.amount;
    if (entry.accountType === "AVAILABLE") {
      available = roundMoney(available + signed);
      if (entry.direction === "CREDIT" && entry.transactionType === "creator_earnings") {
        totalEarnings = roundMoney(totalEarnings + entry.amount);
      }
      if (
        entry.direction === "CREDIT" &&
        (entry.transactionType === "marketplace_vendor_release" ||
          entry.transactionType === "funding_deal_release" ||
          entry.transactionType === "sync_licensing_release")
      ) {
        totalEarnings = roundMoney(totalEarnings + entry.amount);
      }
    } else if (entry.accountType === "PENDING") {
      pending = roundMoney(pending + signed);
      if (entry.direction === "DEBIT" && entry.transactionType === "withdrawal_completed") {
        totalWithdrawn = roundMoney(totalWithdrawn + entry.amount);
      }
    } else if (entry.accountType === "LOCKED") {
      locked = roundMoney(locked + signed);
    }
  }

  return {
    availableBalance: Math.max(0, available),
    pendingBalance: Math.max(0, pending),
    lockedBalance: Math.max(0, locked),
    totalEarnings: Math.max(0, totalEarnings),
    totalWithdrawn: Math.max(0, totalWithdrawn),
    hasTreasuryContamination,
  };
}

export function humanizeLedgerType(transactionType: string): string {
  const labels: Record<string, string> = {
    creator_earnings: "Creator earnings",
    withdrawal_hold: "Payout hold",
    withdrawal_completed: "Payout paid",
    withdrawal_declined: "Payout declined",
    withdrawal_released: "Payout released",
    marketplace_vendor_release: "Marketplace release",
    funding_deal_release: "Funding release",
    sync_licensing_release: "Sync licensing release",
  };
  return labels[transactionType] ?? transactionType.replace(/_/g, " ");
}
