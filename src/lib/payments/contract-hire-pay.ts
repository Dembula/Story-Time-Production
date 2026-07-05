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
  finalizeContractHireWalletPayment,
  resolveContractHireSettlement,
  type ContractHireSettlementQuote,
} from "@/lib/payments/contract-hire-settlement";
import { toGatewaySafeReference } from "@/lib/payments/reference";
import { getPayFastTokenForUser } from "@/lib/payments/payfast-saved-card";

const db = prisma as any;

type SavedCardPayResult =
  | { mode: "completed"; paymentRecordId: string }
  | { mode: "pending"; paymentRecordId: string }
  | null;

async function trySavedCardContractHirePay(args: {
  quote: ContractHireSettlementQuote;
  buyerUserId: string;
}): Promise<SavedCardPayResult> {
  const tokenLookup = await getPayFastTokenForUser(args.buyerUserId);
  const token = tokenLookup?.token;
  if (!token) return null;

  const paymentRecord = await db.paymentRecord.create({
    data: {
      userId: args.buyerUserId,
      provider: PAYMENT_PROVIDER,
      purpose: args.quote.purpose,
      status: "PENDING",
      amount: args.quote.totalAmount,
      currency: "ZAR",
      relatedEntityType: "ProjectContract",
      relatedEntityId: args.quote.contractId,
      metadata: {
        contractHire: true,
        projectId: args.quote.projectId,
        baseAmount: args.quote.baseAmount,
        platformFeeAmount: args.quote.platformFeeAmount,
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
      reference: toGatewaySafeReference("pf-hire", paymentRecord.id),
      paymentRecordId: paymentRecord.id,
    });

    await db.gatewayReference.create({
      data: {
        provider: charge.provider,
        referenceType: "ProjectContract",
        referenceId: args.quote.contractId,
        externalRef: charge.externalRef,
        metadata: { paymentRecordId: paymentRecord.id, source: "contract_hire_saved_card" },
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

    await db.paymentRecord.update({ where: { id: paymentRecord.id }, data: { status: "FAILED" } }).catch(() => {});
    return null;
  } catch {
    await db.paymentRecord.update({ where: { id: paymentRecord.id }, data: { status: "FAILED" } }).catch(() => {});
    return null;
  }
}

export async function payContractHire(args: {
  contractId: string;
  projectId: string;
  payerUserId: string;
  payerEmail?: string | null;
  payerName?: string | null;
  returnPath: string;
}) {
  const resolved = await resolveContractHireSettlement(args.contractId, args.projectId, args.payerUserId);
  if (!resolved.ok) {
    return { ok: false as const, error: resolved.error, status: resolved.status };
  }

  const walletResult = await finalizeContractHireWalletPayment(resolved.quote);
  if (walletResult.ok) {
    return {
      ok: true as const,
      requiresPayment: false,
      transactionId: walletResult.transactionId,
      paymentMode: walletResult.paymentMode,
      baseAmount: walletResult.baseAmount,
      platformFeeAmount: walletResult.platformFeeAmount,
      feeAmount: walletResult.platformFeeAmount,
      totalAmount: walletResult.totalAmount,
      gatewayFeeEstimate: resolved.quote.gatewayFeeEstimate,
      payeeLabel: resolved.quote.payeeLabel,
    };
  }

  const savedCardResult = await trySavedCardContractHirePay({
    quote: resolved.quote,
    buyerUserId: args.payerUserId,
  });

  if (savedCardResult?.mode === "pending") {
    return {
      ok: true as const,
      requiresPayment: true,
      awaitingGatewayConfirmation: true,
      paymentRecordId: savedCardResult.paymentRecordId,
      baseAmount: resolved.quote.baseAmount,
      platformFeeAmount: resolved.quote.platformFeeAmount,
      feeAmount: resolved.quote.platformFeeAmount,
      totalAmount: resolved.quote.totalAmount,
      gatewayFeeEstimate: resolved.quote.gatewayFeeEstimate,
      payeeLabel: resolved.quote.payeeLabel,
      walletHint: walletResult.error,
    };
  }

  if (savedCardResult?.mode === "completed") {
    const tx = await prisma.transaction.findFirst({
      where: { referenceId: args.contractId, payerId: args.payerUserId },
      orderBy: { createdAt: "desc" },
    });
    return {
      ok: true as const,
      requiresPayment: false,
      transactionId: tx?.id ?? savedCardResult.paymentRecordId,
      paymentMode: "saved_card" as const,
      baseAmount: resolved.quote.baseAmount,
      platformFeeAmount: resolved.quote.platformFeeAmount,
      feeAmount: resolved.quote.platformFeeAmount,
      totalAmount: resolved.quote.totalAmount,
      gatewayFeeEstimate: resolved.quote.gatewayFeeEstimate,
      payeeLabel: resolved.quote.payeeLabel,
    };
  }

  try {
    const { checkout, paymentRecord } = await initializeCheckout({
      userId: args.payerUserId,
      email: args.payerEmail,
      customerName: args.payerName,
      amount: resolved.quote.totalAmount,
      purpose: resolved.quote.purpose,
      referenceType: "ProjectContract",
      referenceId: args.contractId,
      returnUrl: buildPaymentReturnUrl(args.returnPath, `contract_hire_${args.contractId}`),
      metadata: {
        contractHire: true,
        projectId: args.projectId,
        baseAmount: resolved.quote.baseAmount,
        platformFeeAmount: resolved.quote.platformFeeAmount,
      },
    });

    return {
      ok: true as const,
      requiresPayment: true,
      checkoutUrl: checkout.checkoutUrl,
      paymentRecordId: paymentRecord.id,
      baseAmount: resolved.quote.baseAmount,
      platformFeeAmount: resolved.quote.platformFeeAmount,
      feeAmount: resolved.quote.platformFeeAmount,
      totalAmount: resolved.quote.totalAmount,
      gatewayFeeEstimate: resolved.quote.gatewayFeeEstimate,
      payeeLabel: resolved.quote.payeeLabel,
      walletHint: walletResult.error,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
    return { ok: false as const, error: message, status: 502 };
  }
}
