import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { recordGatewayEventIfNew } from "@/lib/payments/idempotency";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import {
  collectPossibleMerchantReferences,
  isLikelyPaymentSuccessEvent,
} from "@/lib/payments/stitch-webhook-payload";
const db = prisma as any;

function parseJsonPayload(raw: string): Record<string, unknown> {
  try {
    return (JSON.parse(raw || "{}") as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

function isLikelyFailureOrCancelledEvent(payload: Record<string, unknown>): boolean {
  const t = String(payload.type || payload.eventType || "").toLowerCase();
  return (
    t.includes("failed") ||
    t.includes("failure") ||
    t.includes("cancelled") ||
    t.includes("canceled") ||
    t.includes("expired")
  );
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const gateway = getPaymentGateway();
  const valid = gateway.verifyWebhookSignature(rawBody, (name) => req.headers.get(name));
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const root = parseJsonPayload(rawBody);
  const dataObject = root.data;
  const eventBody =
    dataObject && typeof dataObject === "object" && !Array.isArray(dataObject)
      ? (dataObject as Record<string, unknown>)
      : root;

  const event = await recordGatewayEventIfNew({
    provider: "STITCH",
    eventType: String(root.type || eventBody.type || "UNKNOWN"),
    eventId: (root.id as string | undefined) || (eventBody.id as string | undefined),
    payload: root as unknown as Record<string, unknown>,
    signatureVerified: true,
  });
  if (!event) return NextResponse.json({ ok: true, duplicate: true });

  const success =
    (isLikelyPaymentSuccessEvent(root) || isLikelyPaymentSuccessEvent(eventBody)) &&
    !isLikelyFailureOrCancelledEvent(root) &&
    !isLikelyFailureOrCancelledEvent(eventBody);

  if (success) {
    const refCandidates = new Set<string>([
      ...collectPossibleMerchantReferences(root),
      ...collectPossibleMerchantReferences(eventBody),
    ]);

    let gatewayRef = null;
    for (const externalRef of refCandidates) {
      if (!externalRef) continue;
      gatewayRef = await db.gatewayReference.findUnique({
        where: { provider_externalRef: { provider: "STITCH", externalRef } },
      });
      if (gatewayRef) break;
    }

    const paymentRecordFromPayload = String(
      (eventBody as { paymentRecordId?: string }).paymentRecordId || "",
    );
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
        if (paymentRecord && paymentRecord.userId && paymentRecord.status !== "SUCCEEDED") {
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
          if (paymentRecord.relatedEntityType === "ViewerContentAccess" && paymentRecord.relatedEntityId) {
            await db.viewerContentAccess.update({
              where: { id: paymentRecord.relatedEntityId },
              data: {
                status: "COMPLETED",
                purchasedAt: new Date(),
              },
            });
          }
          if (paymentRecord.relatedEntityType === "CreatorDistributionLicense" && paymentRecord.relatedEntityId) {
            await db.creatorDistributionLicense.update({
              where: { id: paymentRecord.relatedEntityId },
              data: {
                lastPaymentStatus: "SUCCEEDED",
                lastPaymentAt: new Date(),
                lastPaymentError: null,
              },
            });
          }
          if (paymentRecord.relatedEntityType === "CompanySubscription" && paymentRecord.relatedEntityId) {
            await db.companySubscription.update({
              where: { id: paymentRecord.relatedEntityId },
              data: {
                status: "ACTIVE",
                lastPaymentStatus: "SUCCEEDED",
                lastPaymentAt: new Date(),
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
