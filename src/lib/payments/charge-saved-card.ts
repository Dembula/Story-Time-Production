import "server-only";

import { prisma } from "@/lib/prisma";
import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import { completeGatewayPayment } from "@/lib/payments/complete-gateway-payment";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { getPayFastTokenForUser } from "@/lib/payments/payfast-saved-card";
import { toGatewaySafeReference } from "@/lib/payments/reference";
import {
  estimatePayFastFee,
  estimatePayFastSettlement,
  normalizePayFastMethodCode,
  payFastMethodLabel,
  type PayFastSettlementBreakdown,
} from "@/lib/payments/payfast-settlement";

const db = prisma as any;

export type SavedCardChargeResult =
  | { ok: true; status: "COMPLETED"; paymentRecordId: string; externalRef: string }
  | { ok: false; status: "PENDING"; paymentRecordId: string; reason: "charge_pending" }
  | { ok: false; status: "FAILED"; reason: string; message?: string };

export async function chargeUserSavedCard(args: {
  userId: string;
  email?: string | null;
  amount: number;
  purpose: string;
  referenceType: string;
  referenceId: string;
  gatewayReferencePrefix: string;
  metadata?: Record<string, unknown>;
}): Promise<SavedCardChargeResult> {
  const tokenLookup = await getPayFastTokenForUser(args.userId);
  const chargeToken = tokenLookup?.token ?? null;
  if (!chargeToken) {
    return { ok: false, status: "FAILED", reason: "missing_card_consent", message: "No PayFast card on file." };
  }

  const paymentRecord = await db.paymentRecord.create({
    data: {
      userId: args.userId,
      provider: PAYMENT_PROVIDER,
      purpose: args.purpose,
      status: "PENDING",
      amount: args.amount,
      currency: "ZAR",
      email: args.email ?? null,
      relatedEntityType: args.referenceType,
      relatedEntityId: args.referenceId,
      metadata: { source: "auto_renewal", ...(args.metadata ?? {}) },
    },
  });

  const gateway = getPaymentGateway();
  try {
    const charge = await gateway.chargeSavedCard({
      consentReference: chargeToken,
      amount: args.amount,
      currency: "ZAR",
      reference: toGatewaySafeReference(args.gatewayReferencePrefix, paymentRecord.id),
      paymentRecordId: paymentRecord.id,
    });

    await db.gatewayReference.create({
      data: {
        provider: charge.provider,
        referenceType: args.referenceType,
        referenceId: args.referenceId,
        externalRef: charge.externalRef,
        metadata: { paymentRecordId: paymentRecord.id, source: "auto_renewal" },
      },
    });

    if (charge.status === "PENDING") {
      await db.paymentRecord.update({
        where: { id: paymentRecord.id },
        data: { status: "PENDING" },
      });
      return { ok: false, status: "PENDING", paymentRecordId: paymentRecord.id, reason: "charge_pending" };
    }

    if (charge.status !== "COMPLETED") {
      await db.paymentRecord.update({
        where: { id: paymentRecord.id },
        data: { status: "FAILED" },
      });
      return { ok: false, status: "FAILED", reason: "charge_not_completed" };
    }

    const methodCode = normalizePayFastMethodCode(tokenLookup?.cardType);
    const settlement: PayFastSettlementBreakdown = {
      amountGross: args.amount,
      providerFeeAmount: estimatePayFastFee(args.amount, methodCode),
      settlementAmount: estimatePayFastSettlement(args.amount, methodCode),
      providerPaymentMethod: methodCode,
      providerPaymentMethodLabel: payFastMethodLabel(methodCode),
      settlementSource: "estimated",
    };

    await completeGatewayPayment(paymentRecord.id, {
      reference: charge.externalRef,
      settlement,
    });
    return {
      ok: true,
      status: "COMPLETED",
      paymentRecordId: paymentRecord.id,
      externalRef: charge.externalRef,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automatic charge failed.";
    await db.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: { status: "FAILED", metadata: { ...(args.metadata ?? {}), chargeError: message } },
    });
    return { ok: false, status: "FAILED", reason: "charge_failed", message };
  }
}
