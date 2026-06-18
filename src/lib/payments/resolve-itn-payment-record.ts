import "server-only";

import { prisma } from "@/lib/prisma";

const db = prisma as any;

/** Resolve a gateway `PaymentRecord` id from PayFast ITN fields (custom_str1, m_payment_id, pf_payment_id). */
export async function resolvePaymentRecordIdFromPayFastItn(
  data: Record<string, string | undefined>,
): Promise<string | null> {
  const customId = data.custom_str1?.trim();
  if (customId) {
    const byCustom = await db.paymentRecord.findUnique({
      where: { id: customId },
      select: { id: true },
    });
    if (byCustom) return byCustom.id;
  }

  const mPaymentId = data.m_payment_id?.trim();
  if (mPaymentId) {
    const byId = await db.paymentRecord.findUnique({
      where: { id: mPaymentId },
      select: { id: true },
    });
    if (byId) return byId.id;

    const byGatewayRef = await db.gatewayReference.findFirst({
      where: { externalRef: mPaymentId },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });
    const fromMeta = (byGatewayRef?.metadata as { paymentRecordId?: string } | null)?.paymentRecordId;
    if (fromMeta) return fromMeta;
  }

  const pfPaymentId = data.pf_payment_id?.trim();
  if (pfPaymentId) {
    const byPfRef = await db.gatewayReference.findFirst({
      where: { externalRef: pfPaymentId },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });
    const fromPfMeta = (byPfRef?.metadata as { paymentRecordId?: string } | null)?.paymentRecordId;
    if (fromPfMeta) return fromPfMeta;
  }

  return null;
}
