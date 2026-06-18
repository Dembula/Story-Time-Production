import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { completeGatewayPayment } from "@/lib/payments/complete-gateway-payment";
import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import {
  estimatePayFastFee,
  estimatePayFastSettlement,
  normalizePayFastMethodCode,
  payFastMethodLabel,
} from "@/lib/payments/payfast-settlement";
import { prisma } from "@/lib/prisma";
import {
  finalizeMarketplaceWalletPayment,
  resolveMarketplaceSettlement,
  type MarketplaceEntityType,
  type MarketplaceSettlementQuote,
} from "@/lib/payments/marketplace-settlement";
import { toGatewaySafeReference } from "@/lib/payments/reference";
import { getPayFastTokenForUser } from "@/lib/payments/payfast-saved-card";

const db = prisma as any;

type SavedCardPayResult =
  | { mode: "completed"; paymentRecordId: string }
  | { mode: "pending"; paymentRecordId: string }
  | null;

async function trySavedCardMarketplacePay(args: {
  quote: MarketplaceSettlementQuote;
  buyerUserId: string;
}): Promise<SavedCardPayResult> {
  const tokenLookup = await getPayFastTokenForUser(args.buyerUserId);
  const token = tokenLookup?.token;
  if (!token) return null;

  const paymentRecord = await db.paymentRecord.create({
    data: {
      userId: args.buyerUserId,
      provider: "PAYFAST",
      purpose: args.quote.purpose,
      status: "PENDING",
      amount: args.quote.totalAmount,
      currency: "ZAR",
      relatedEntityType: args.quote.entityType,
      relatedEntityId: args.quote.entityId,
      metadata: {
        marketplace: true,
        baseAmount: args.quote.baseAmount,
        feeAmount: args.quote.feeAmount,
        savedCard: true,
      },
    },
  });

  const gateway = getPaymentGateway();
  try {
    const charge = await gateway.chargeSavedCard({
      consentReference: token,
      amount: args.quote.totalAmount,
      currency: "ZAR",
      reference: toGatewaySafeReference("pf-mkt", paymentRecord.id),
      paymentRecordId: paymentRecord.id,
    });

    await db.gatewayReference.create({
      data: {
        provider: charge.provider,
        referenceType: args.quote.entityType,
        referenceId: args.quote.entityId,
        externalRef: charge.externalRef,
        metadata: { paymentRecordId: paymentRecord.id, source: "marketplace_saved_card" },
      },
    });

    if (charge.status === "COMPLETED") {
      const methodCode = normalizePayFastMethodCode(tokenLookup?.cardType);
      await completeGatewayPayment(paymentRecord.id, {
        reference: charge.externalRef,
        settlement: {
          amountGross: args.quote.totalAmount,
          providerFeeAmount: estimatePayFastFee(args.quote.totalAmount, methodCode),
          settlementAmount: estimatePayFastSettlement(args.quote.totalAmount, methodCode),
          providerPaymentMethod: methodCode,
          providerPaymentMethodLabel: payFastMethodLabel(methodCode),
          settlementSource: "estimated",
        },
      });
      return { mode: "completed", paymentRecordId: paymentRecord.id };
    }

    if (charge.status === "PENDING") {
      return { mode: "pending", paymentRecordId: paymentRecord.id };
    }

    await db.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: { status: "FAILED" },
    }).catch(() => {});
    return null;
  } catch {
    await db.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: { status: "FAILED" },
    }).catch(() => {});
    return null;
  }
}

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

  const savedCardResult = await trySavedCardMarketplacePay({
    quote: resolved.quote,
    buyerUserId: args.buyerUserId,
  });

  if (savedCardResult?.mode === "pending") {
    return {
      ok: true as const,
      requiresPayment: true,
      awaitingGatewayConfirmation: true,
      paymentRecordId: savedCardResult.paymentRecordId,
      baseAmount: resolved.quote.baseAmount,
      feeAmount: resolved.quote.feeAmount,
      totalAmount: resolved.quote.totalAmount,
      walletHint: walletResult.error,
    };
  }

  if (savedCardResult?.mode === "completed") {
    const tx = await prisma.transaction.findFirst({
      where: { referenceId: resolved.quote.entityId, payerId: args.buyerUserId },
      orderBy: { createdAt: "desc" },
    });
    return {
      ok: true as const,
      requiresPayment: false,
      transactionId: tx?.id ?? savedCardResult.paymentRecordId,
      paymentMode: "saved_card" as const,
      baseAmount: resolved.quote.baseAmount,
      feeAmount: resolved.quote.feeAmount,
      totalAmount: resolved.quote.totalAmount,
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
