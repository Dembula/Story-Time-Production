import { prisma } from "@/lib/prisma";

const db = prisma as any;

/** Apply domain side-effects after a payment record is marked SUCCEEDED. */
export async function applyPaymentRecordSettlementEffects(paymentRecord: {
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
}
