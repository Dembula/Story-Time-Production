import "server-only";

import { prisma } from "@/lib/prisma";
import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import { parsePayFastFormBody } from "@/lib/payments/providers/payfast-signature";

const db = prisma as any;

type ItnPayload = { rawBody?: string; fields?: Record<string, string> } | null | undefined;

function itnFieldsFromPayload(payload: ItnPayload): Record<string, string> | null {
  if (!payload) return null;
  if (payload.fields && typeof payload.fields === "object") return payload.fields;
  if (payload.rawBody) return parsePayFastFormBody(payload.rawBody);
  return null;
}

function itnMatchesPaymentRecord(fields: Record<string, string>, paymentRecordId: string): boolean {
  const custom = fields.custom_str1?.trim();
  const mPaymentId = fields.m_payment_id?.trim();
  return custom === paymentRecordId || mPaymentId === paymentRecordId;
}

/** True while PayFast checkout/renewal ITN is still expected for this entity. */
export async function hasPendingGatewayPayment(
  referenceType: string,
  referenceId: string,
): Promise<boolean> {
  const pending = await db.paymentRecord.findFirst({
    where: {
      relatedEntityType: referenceType,
      relatedEntityId: referenceId,
      status: "PENDING",
    },
    select: { id: true },
  });
  return Boolean(pending);
}

/** Find the most recent stored PayFast ITN webhook for a payment record. */
export async function findStoredItnWebhookForPayment(paymentRecordId: string) {
  const byReference = await db.paymentWebhookEvent.findFirst({
    where: {
      provider: PAYMENT_PROVIDER,
      eventType: "itn",
      reference: paymentRecordId,
    },
    orderBy: { createdAt: "desc" },
  });
  if (byReference) return byReference;

  const payment = await db.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    select: { providerPaymentId: true },
  });

  const recent = await db.paymentWebhookEvent.findMany({
    where: { provider: PAYMENT_PROVIDER, eventType: "itn" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  for (const webhook of recent) {
    const fields = itnFieldsFromPayload(webhook.payload as ItnPayload);
    if (!fields) continue;
    if (itnMatchesPaymentRecord(fields, paymentRecordId)) return webhook;
    const pfPaymentId = fields.pf_payment_id?.trim();
    if (pfPaymentId && payment?.providerPaymentId === pfPaymentId) return webhook;
  }

  return null;
}

/** @deprecated Use hasPendingGatewayPayment */
export async function hasPendingRenewalPayment(referenceType: string, referenceId: string) {
  return hasPendingGatewayPayment(referenceType, referenceId);
}
