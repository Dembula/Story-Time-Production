import { prisma } from "@/lib/prisma";
import { finalizeMarketplaceGatewayPayment } from "@/lib/payments/marketplace-settlement";

const db = prisma as any;

const MARKETPLACE_ENTITY_TYPES = new Set([
  "EquipmentRequest",
  "LocationBooking",
  "CateringBooking",
  "CrewTeamRequest",
  "CastingInquiry",
]);

/** Apply domain side-effects after a payment record is marked SUCCEEDED. */
export async function applyPaymentRecordSettlementEffects(paymentRecord: {
  id?: string;
  purpose?: string | null;
  amount?: number | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
}) {
  if (
    paymentRecord.relatedEntityType === "ViewerSubscription" &&
    paymentRecord.relatedEntityId &&
    typeof paymentRecord.amount === "number"
  ) {
    const now = new Date();
    const current = await db.viewerSubscription.findUnique({
      where: { id: paymentRecord.relatedEntityId },
      select: { currentPeriodEnd: true },
    });
    const base = current?.currentPeriodEnd && current.currentPeriodEnd > now ? current.currentPeriodEnd : now;
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

    await db.subscriptionPayment.create({
      data: {
        viewerSubscriptionId: paymentRecord.relatedEntityId,
        amount: paymentRecord.amount,
        currency: "ZAR",
        status: "COMPLETED",
        purpose: paymentRecord.purpose ?? "viewer_subscription",
        paidAt: now,
      },
    });
  }

  if (paymentRecord.relatedEntityType === "ViewerContentAccess" && paymentRecord.relatedEntityId) {
    await db.viewerContentAccess.update({
      where: { id: paymentRecord.relatedEntityId },
      data: { status: "COMPLETED", purchasedAt: new Date() },
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

  if (paymentRecord.relatedEntityType === "MusicTrack" && paymentRecord.relatedEntityId) {
    await db.musicTrack.update({
      where: { id: paymentRecord.relatedEntityId },
      data: { published: true },
    });
  }

  if (
    paymentRecord.id &&
    paymentRecord.relatedEntityType &&
    MARKETPLACE_ENTITY_TYPES.has(paymentRecord.relatedEntityType) &&
    paymentRecord.relatedEntityId
  ) {
    await finalizeMarketplaceGatewayPayment(paymentRecord.id).catch((err: unknown) => {
      console.error("marketplace gateway settlement failed", err);
    });
  }
}
