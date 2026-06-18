import { ensureWalletForUser } from "@/lib/payments/wallet";
import { postMarketplacePaymentAllocation } from "@/lib/payments/marketplace-allocation";

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

  await postMarketplacePaymentAllocation({
    payerUserId: args.buyerUserId,
    sellerUserId: args.sellerUserId,
    baseAmount: args.baseAmount,
    feeAmount: args.feeAmount,
    totalAmount: args.totalAmount,
    referenceType: args.referenceType,
    referenceId: args.referenceId,
    idempotencyKey: args.escrowIdempotencyKey,
    paymentSource: "wallet",
  });

  return {
    ok: true as const,
    buyerWalletId: buyerWallet.id,
  };
}
