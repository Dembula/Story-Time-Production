import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import {
  finalizeMarketplaceWalletPayment,
  resolveMarketplaceSettlement,
  type MarketplaceEntityType,
} from "@/lib/payments/marketplace-settlement";

export async function payMarketplaceEntity(args: {
  entityType: MarketplaceEntityType;
  entityId: string;
  buyerUserId: string;
  buyerEmail?: string | null;
  buyerName?: string | null;
  returnPath: string;
}) {
  const resolved = await resolveMarketplaceSettlement(args.entityType, args.entityId, args.buyerUserId);
  if (!resolved.ok) {
    return { ok: false as const, error: resolved.error, status: resolved.status };
  }

  const walletResult = await finalizeMarketplaceWalletPayment(resolved.quote);
  if (walletResult.ok) {
    return {
      ok: true as const,
      requiresPayment: false,
      transactionId: walletResult.transactionId,
      paymentMode: walletResult.paymentMode,
      baseAmount: walletResult.baseAmount,
      feeAmount: walletResult.feeAmount,
      totalAmount: walletResult.totalAmount,
    };
  }

  try {
    const { checkout, paymentRecord } = await initializeCheckout({
      userId: args.buyerUserId,
      email: args.buyerEmail,
      customerName: args.buyerName,
      amount: resolved.quote.totalAmount,
      purpose: resolved.quote.purpose,
      referenceType: args.entityType,
      referenceId: args.entityId,
      returnUrl: buildPaymentReturnUrl(args.returnPath, `marketplace_${args.entityType}`),
      metadata: {
        marketplace: true,
        baseAmount: resolved.quote.baseAmount,
        feeAmount: resolved.quote.feeAmount,
      },
    });

    return {
      ok: true as const,
      requiresPayment: true,
      checkoutUrl: checkout.checkoutUrl,
      paymentRecordId: paymentRecord.id,
      baseAmount: resolved.quote.baseAmount,
      feeAmount: resolved.quote.feeAmount,
      totalAmount: resolved.quote.totalAmount,
      walletHint: walletResult.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
    return {
      ok: false as const,
      error: `${walletResult.error} ${message}`.trim(),
      status: 502,
    };
  }
}
