import { prisma } from "@/lib/prisma";
import { createEscrowHold } from "@/lib/payments/escrow";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";

const db = prisma as any;

export async function settleMarketplaceWithWallet(args: {
  buyerUserId: string;
  sellerUserId: string;
  baseAmount: number;
  feeAmount: number;
  totalAmount: number;
  referenceType: string;
  referenceId: string;
  escrowIdempotencyKey: string;
}) {
  const buyerWallet = await ensureWalletForUser(args.buyerUserId);
  await ensureWalletForUser(args.sellerUserId);

  if ((buyerWallet.availableBalance ?? 0) < args.totalAmount) {
    return {
      ok: false as const,
      error: `Insufficient wallet balance. Need R${args.totalAmount.toFixed(2)} available.`,
    };
  }

  await createEscrowHold({
    buyerUserId: args.buyerUserId,
    sellerUserId: args.sellerUserId,
    amount: args.baseAmount,
    referenceType: args.referenceType,
    referenceId: args.referenceId,
    idempotencyKey: args.escrowIdempotencyKey,
  });

  if (args.feeAmount > 0) {
    const treasury =
      (await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })) ??
      ({ id: args.buyerUserId } as { id: string });
    await ensureWalletForUser(treasury.id);

    await postBalancedLedgerBatch({
      idempotencyKey: `${args.escrowIdempotencyKey}_fee`,
      referenceType: args.referenceType,
      referenceId: args.referenceId,
      entries: [
        {
          userId: args.buyerUserId,
          direction: "DEBIT",
          accountType: "AVAILABLE",
          transactionType: "marketplace_fee",
          amount: args.feeAmount,
        },
        {
          userId: treasury.id,
          direction: "CREDIT",
          accountType: "PLATFORM_REVENUE",
          transactionType: "marketplace_fee",
          amount: args.feeAmount,
        },
      ],
    });
  }

  return {
    ok: true as const,
    buyerWalletId: buyerWallet.id,
  };
}
