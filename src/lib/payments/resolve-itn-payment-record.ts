import "server-only";

import { prisma } from "@/lib/prisma";

const db = prisma as any;

async function findCardConsentByReference(consentReference: string): Promise<string | null> {
  const recent = await db.paymentRecord.findMany({
    where: { purpose: "CARD_CONSENT" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, metadata: true },
  });
  const matched = recent.find((row: { metadata?: unknown }) => {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    return meta.consentReference === consentReference;
  });
  return matched?.id ?? null;
}

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

    // Legacy card-consent / trial-consent used consent reference as m_payment_id.
    if (mPaymentId.startsWith("card-consent-") || mPaymentId.startsWith("trial-consent-")) {
      const legacy = await findCardConsentByReference(mPaymentId);
      if (legacy) return legacy;
    }

    const byLegacyRef = await db.gatewayReference.findFirst({
      where: { externalRef: mPaymentId },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });
    const fromMeta = (byLegacyRef?.metadata as { paymentRecordId?: string } | null)?.paymentRecordId;
    if (fromMeta) return fromMeta;
  }

  const consentRef = data.custom_str3?.trim();
  if (consentRef && (consentRef.startsWith("card-consent-") || consentRef.startsWith("trial-consent-"))) {
    const byConsent = await findCardConsentByReference(consentRef);
    if (byConsent) return byConsent;
  }

  const pfPaymentId = data.pf_payment_id?.trim();
  if (pfPaymentId) {
    const byProvider = await db.paymentRecord.findFirst({
      where: { providerPaymentId: pfPaymentId },
      select: { id: true },
    });
    if (byProvider) return byProvider.id;

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
