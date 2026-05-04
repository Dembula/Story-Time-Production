import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { recordGatewayEventIfNew } from "@/lib/payments/idempotency";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { ensureWalletForUser } from "@/lib/payments/wallet";
const db = prisma as any;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-stitch-signature");
  const gateway = getPaymentGateway();
  const valid = gateway.verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: {
    id?: string;
    type?: string;
    data?: Record<string, unknown>;
  };
  try {
    payload = (JSON.parse(rawBody || "{}") as {
      id?: string;
      type?: string;
      data?: Record<string, unknown>;
    }) ?? { data: {} };
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  const event = await recordGatewayEventIfNew({
    provider: "STITCH",
    eventType: payload.type || "UNKNOWN",
    eventId: payload.id,
    payload: payload as unknown as Record<string, unknown>,
    signatureVerified: true,
  });
  if (!event) return NextResponse.json({ ok: true, duplicate: true });

  if (payload.type === "payment.succeeded" || payload.type === "payment.completed" || payload.type === "payin.succeeded") {
    const externalRef = String(payload.data?.reference || payload.data?.externalRef || "");
    const paymentRecordFromPayload = String(payload.data?.paymentRecordId || "");
    let gatewayRef = null;
    if (externalRef) {
      gatewayRef = await db.gatewayReference.findUnique({
        where: { provider_externalRef: { provider: "STITCH", externalRef } },
      });
    }
    if (!gatewayRef && paymentRecordFromPayload) {
      gatewayRef = await db.gatewayReference.findFirst({
        where: {
          provider: "STITCH",
          metadata: { path: ["paymentRecordId"], equals: paymentRecordFromPayload },
        },
      });
    }
    if (gatewayRef) {
      const paymentRecordId = (gatewayRef.metadata as { paymentRecordId?: string } | null)?.paymentRecordId;
      if (paymentRecordId) {
        const paymentRecord = await db.paymentRecord.findUnique({ where: { id: paymentRecordId } });
        if (paymentRecord && paymentRecord.userId) {
          await ensureWalletForUser(paymentRecord.userId);
          const treasury =
            (await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } })) ??
            ({ id: paymentRecord.userId } as { id: string });
          await ensureWalletForUser(treasury.id);
          await postBalancedLedgerBatch({
            idempotencyKey: `webhook_${event.id}`,
            referenceType: paymentRecord.relatedEntityType || "PAYMENT_RECORD",
            referenceId: paymentRecord.relatedEntityId || paymentRecord.id,
            entries: [
              {
                userId: paymentRecord.userId,
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
          if (paymentRecord.relatedEntityType === "ViewerSubscription" && paymentRecord.relatedEntityId) {
            const now = new Date();
            const current = await db.viewerSubscription.findUnique({
              where: { id: paymentRecord.relatedEntityId },
              select: { currentPeriodEnd: true },
            });
            const base =
              current?.currentPeriodEnd && current.currentPeriodEnd > now ? current.currentPeriodEnd : now;
            const nextPeriodEnd = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
            await db.viewerSubscription.update({
              where: { id: paymentRecord.relatedEntityId },
              data: {
                status: "ACTIVE",
                currentPeriodEnd: nextPeriodEnd,
                lastPaymentStatus: "SUCCEEDED",
                lastPaymentAt: now,
                lastPaymentError: null,
              },
            });
          }
        }
      }
    }
  }

  await db.gatewayEvent.update({
    where: { id: event.id },
    data: { processed: true, processedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
