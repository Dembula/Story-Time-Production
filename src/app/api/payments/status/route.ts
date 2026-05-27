import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { applyPaymentRecordSettlementEffects } from "@/lib/payments/settlement-effects";

const db = prisma as any;

async function settlePaymentRecord(paymentRecordId: string) {
  const paymentRecord = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
  if (!paymentRecord || !paymentRecord.userId) return false;
  if (paymentRecord.status === "SUCCEEDED") return true;

  await ensureWalletForUser(paymentRecord.userId);
  const treasury =
    (await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })) ??
    ({ id: paymentRecord.userId } as { id: string });
  await ensureWalletForUser(treasury.id);

  await postBalancedLedgerBatch({
    idempotencyKey: `payment_record_success_${paymentRecord.id}`,
    referenceType: paymentRecord.relatedEntityType || "PAYMENT_RECORD",
    referenceId: paymentRecord.relatedEntityId || paymentRecord.id,
    entries: [
      {
        // End-users pay Story Time first; do not credit the payer's wallet.
        userId: treasury.id,
        direction: "CREDIT",
        accountType: "AVAILABLE",
        transactionType: "incoming_payment",
        amount: paymentRecord.amount,
      },
      {
        userId: treasury.id,
        direction: "DEBIT",
        accountType: "PLATFORM_REVENUE",
        transactionType: "incoming_payment",
        amount: paymentRecord.amount,
      },
    ],
  });

  await db.paymentRecord.update({
    where: { id: paymentRecord.id },
    data: { status: "SUCCEEDED", paidAt: new Date() },
  });

  await applyPaymentRecordSettlementEffects({
    relatedEntityType: paymentRecord.relatedEntityType,
    relatedEntityId: paymentRecord.relatedEntityId,
  });

  return true;
}

export async function GET(req: NextRequest) {
  const paymentRecordId = req.nextUrl.searchParams.get("paymentRecordId");
  if (!paymentRecordId) {
    return NextResponse.json({ error: "paymentRecordId is required." }, { status: 400 });
  }

  let payment = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    select: {
      id: true,
      status: true,
      paidAt: true,
      updatedAt: true,
      purpose: true,
      relatedEntityType: true,
      relatedEntityId: true,
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
  }

  if (payment.status === "PENDING") {
    const gatewayRef = await db.gatewayReference.findFirst({
      where: {
        provider: "STITCH",
        metadata: { path: ["paymentRecordId"], equals: paymentRecordId },
      },
      select: { externalRef: true },
    });

    if (gatewayRef?.externalRef) {
      const gateway = getPaymentGateway() as unknown as {
        listPaymentLinks?: (query?: Record<string, unknown>) => Promise<Record<string, unknown>>;
      };
      if (typeof gateway.listPaymentLinks === "function") {
        try {
          const providerResult = await gateway.listPaymentLinks({
            merchantReference: gatewayRef.externalRef,
            limit: 1,
          });
          const payments = (
            (providerResult.data as { payments?: Array<{ status?: string }> } | undefined)?.payments ?? []
          );
          const providerStatus = String(payments[0]?.status || "").toUpperCase();

          if (providerStatus === "PAID" || providerStatus === "SUCCEEDED" || providerStatus === "SUCCESS") {
            await settlePaymentRecord(paymentRecordId);
          } else if (providerStatus === "FAILED" || providerStatus === "CANCELLED" || providerStatus === "EXPIRED") {
            await db.paymentRecord.update({
              where: { id: paymentRecordId },
              data: { status: "FAILED" },
            });
          }
        } catch {
          // Keep current PENDING state when provider reconciliation fails.
        }
      }
    }
  }

  payment = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    select: {
      id: true,
      status: true,
      paidAt: true,
      updatedAt: true,
      purpose: true,
      relatedEntityType: true,
      relatedEntityId: true,
    },
  });

  return NextResponse.json({
    ok: true,
    payment,
  });
}
