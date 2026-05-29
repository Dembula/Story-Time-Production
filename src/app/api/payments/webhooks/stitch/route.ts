import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { recordGatewayEventIfNew } from "@/lib/payments/idempotency";
import { creditTreasuryFromGatewayPayment } from "@/lib/payments/treasury-inflow";
import {
  collectPossibleMerchantReferences,
  isLikelyPaymentSuccessEvent,
} from "@/lib/payments/stitch-webhook-payload";
import { applyPaymentRecordSettlementEffects } from "@/lib/payments/settlement-effects";
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
          await creditTreasuryFromGatewayPayment({
            id: paymentRecord.id,
            amount: paymentRecord.amount,
            relatedEntityType: paymentRecord.relatedEntityType,
            relatedEntityId: paymentRecord.relatedEntityId,
          });
          await db.paymentRecord.update({
            where: { id: paymentRecord.id },
            data: { status: "SUCCEEDED", paidAt: new Date() },
          });
          await applyPaymentRecordSettlementEffects({
            purpose: paymentRecord.purpose,
            amount: paymentRecord.amount,
            relatedEntityType: paymentRecord.relatedEntityType,
            relatedEntityId: paymentRecord.relatedEntityId,
          });
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
