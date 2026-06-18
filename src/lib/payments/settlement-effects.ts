import { prisma } from "@/lib/prisma";
import { finalizeMarketplaceGatewayPayment } from "@/lib/payments/marketplace-settlement";
import {
  finalizeCastingHirePayment,
  finalizeCastingRoleListingPayment,
} from "@/lib/payments/casting-checkout-settlement";
import { addViewerSubscriptionPeriod } from "@/lib/payments/billing-interval";
import { nextCompanyPeriodEnd } from "@/lib/payments/company-subscription-billing";
import { buildRecurringBillingSuccessReset } from "@/lib/payments/recurring-billing-shared";
import { extendCreatorLicensePeriod } from "@/lib/payments/creator-license-billing";

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
  userId?: string | null;
  purpose?: string | null;
  amount?: number | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  metadata?: unknown;
  paidAt?: Date | string | null;
  createdAt?: Date | string | null;
}) {
  if (
    paymentRecord.relatedEntityType === "ViewerSubscription" &&
    paymentRecord.relatedEntityId &&
    typeof paymentRecord.amount === "number"
  ) {
    const now = new Date();
    const paymentCreatedAt = paymentRecord.createdAt ? new Date(paymentRecord.createdAt) : null;
    const current = await db.viewerSubscription.findUnique({
      where: { id: paymentRecord.relatedEntityId },
      select: { currentPeriodEnd: true },
    });
    const existingPayment = paymentRecord.id
      ? await db.subscriptionPayment.findFirst({
          where: {
            viewerSubscriptionId: paymentRecord.relatedEntityId,
            status: "COMPLETED",
            OR: [
              { externalPaymentId: paymentRecord.id },
              { gatewayReference: paymentRecord.id },
              ...(paymentCreatedAt
                ? [
                    {
                      amount: paymentRecord.amount,
                      purpose: paymentRecord.purpose ?? "viewer_subscription",
                      createdAt: { gte: paymentCreatedAt },
                    },
                  ]
                : []),
            ],
          },
          orderBy: { createdAt: "desc" },
        })
      : null;

    if (existingPayment) {
      if (paymentRecord.id && !existingPayment.externalPaymentId) {
        await db.subscriptionPayment.update({
          where: { id: existingPayment.id },
          data: { externalPaymentId: paymentRecord.id },
        }).catch(() => {});
      }
      await db.viewerSubscription.update({
        where: { id: paymentRecord.relatedEntityId },
        data: {
          status: "ACTIVE",
          trialEndsAt: null,
          lastPaymentStatus: "SUCCEEDED",
          lastPaymentAt: existingPayment.paidAt ?? now,
          ...buildRecurringBillingSuccessReset(),
        },
      });
      return;
    }

    const isRenewal = (paymentRecord.purpose ?? "").includes("renewal");
    let nextPeriodEnd: Date;
    if (isRenewal) {
      const base = current?.currentPeriodEnd && current.currentPeriodEnd > now ? current.currentPeriodEnd : now;
      nextPeriodEnd = addViewerSubscriptionPeriod(base);
    } else {
      nextPeriodEnd = addViewerSubscriptionPeriod(now);
    }
    await db.viewerSubscription.update({
      where: { id: paymentRecord.relatedEntityId },
      data: {
        status: "ACTIVE",
        trialEndsAt: null,
        currentPeriodEnd: nextPeriodEnd,
        lastPaymentStatus: "SUCCEEDED",
        lastPaymentAt: now,
        ...buildRecurringBillingSuccessReset(),
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
        externalPaymentId: paymentRecord.id ?? null,
      },
    });
  }

  if (paymentRecord.relatedEntityType === "ViewerContentAccess" && paymentRecord.relatedEntityId) {
    await db.viewerContentAccess.update({
      where: { id: paymentRecord.relatedEntityId },
      data: {
        status: "COMPLETED",
        purchasedAt: new Date(),
        externalPaymentId: paymentRecord.id ?? undefined,
      },
    });
  }

  if (paymentRecord.relatedEntityType === "CompanySubscription" && paymentRecord.relatedEntityId) {
    const now = new Date();
    const paymentCreatedAt = paymentRecord.createdAt ? new Date(paymentRecord.createdAt) : null;
    const current = await db.companySubscription.findUnique({
      where: { id: paymentRecord.relatedEntityId },
      select: { currentPeriodEnd: true, lastPaymentAt: true, externalPaymentId: true, status: true },
    });
    const alreadyApplied =
      current?.externalPaymentId === paymentRecord.id ||
      Boolean(
        current?.status === "ACTIVE" &&
          current.lastPaymentAt &&
          paymentCreatedAt &&
          new Date(current.lastPaymentAt) >= paymentCreatedAt,
      );
    const isRenewal = (paymentRecord.purpose ?? "").includes("renewal");
    await db.companySubscription.update({
      where: { id: paymentRecord.relatedEntityId },
      data: {
        status: "ACTIVE",
        ...(alreadyApplied
          ? {}
          : { currentPeriodEnd: nextCompanyPeriodEnd(now, isRenewal, current?.currentPeriodEnd ?? null) }),
        lastPaymentStatus: "SUCCEEDED",
        lastPaymentAt: now,
        externalPaymentId: paymentRecord.id ?? undefined,
        ...buildRecurringBillingSuccessReset(),
      },
    });
  }

  if (paymentRecord.relatedEntityType === "CreatorDistributionLicense" && paymentRecord.relatedEntityId) {
    const isRenewal = (paymentRecord.purpose ?? "").includes("renewal");
    const current = await db.creatorDistributionLicense.findUnique({
      where: { id: paymentRecord.relatedEntityId },
      select: { externalPaymentId: true, lastPaymentAt: true, status: true },
    });
    const paymentCreatedAt = paymentRecord.createdAt ? new Date(paymentRecord.createdAt) : null;
    const alreadyApplied =
      current?.externalPaymentId === paymentRecord.id ||
      Boolean(
        current?.status === "ACTIVE" &&
          current.lastPaymentAt &&
          paymentCreatedAt &&
          new Date(current.lastPaymentAt) >= paymentCreatedAt,
      );
    if (isRenewal) {
      if (!alreadyApplied) {
        await extendCreatorLicensePeriod(paymentRecord.relatedEntityId);
      }
      await db.creatorDistributionLicense.update({
        where: { id: paymentRecord.relatedEntityId },
        data: {
          status: "ACTIVE",
          lastPaymentStatus: "SUCCEEDED",
          lastPaymentAt: new Date(),
          externalPaymentId: paymentRecord.id ?? undefined,
          ...buildRecurringBillingSuccessReset(),
        },
      });
    } else {
      await db.creatorDistributionLicense.update({
        where: { id: paymentRecord.relatedEntityId },
        data: {
          status: "ACTIVE",
          lastPaymentStatus: "SUCCEEDED",
          lastPaymentAt: new Date(),
          externalPaymentId: paymentRecord.id ?? undefined,
          ...buildRecurringBillingSuccessReset(),
        },
      });
    }
  }

  if (paymentRecord.relatedEntityType === "MusicTrack" && paymentRecord.relatedEntityId) {
    await db.musicTrack.update({
      where: { id: paymentRecord.relatedEntityId },
      data: { published: true },
    });
  }

  if (paymentRecord.relatedEntityType === "Content" && paymentRecord.relatedEntityId) {
    await db.content.update({
      where: { id: paymentRecord.relatedEntityId },
      data: {
        reviewStatus: "PENDING",
        submittedAt: new Date(),
      },
    });
  }

  if (paymentRecord.relatedEntityType === "ScriptReviewRequest" && paymentRecord.relatedEntityId) {
    const review = await db.scriptReviewRequest.update({
      where: { id: paymentRecord.relatedEntityId },
      data: {
        status: "PENDING_ADMIN_REVIEW",
        paymentId: paymentRecord.id ?? undefined,
      },
      include: { project: { select: { title: true } } },
    });
    if (review?.requesterId) {
      await db.notification.create({
        data: {
          userId: review.requesterId,
          type: "CONTRACT_EVENT",
          title: "Executive script review requested",
          body: `Payment received. Your script for "${review.project?.title ?? "your project"}" is queued for Story Time Executive Script Review.`,
          metadata: JSON.stringify({
            projectId: review.projectId,
            reviewRequestId: review.id,
          }),
        },
      });
    }
  }

  if (paymentRecord.purpose === "AUDITION_LISTING" && paymentRecord.id) {
    await finalizeCastingRoleListingPayment({
      id: paymentRecord.id,
      userId: paymentRecord.userId ?? null,
      relatedEntityId: paymentRecord.relatedEntityId,
      metadata: paymentRecord.metadata,
    }).catch((err: unknown) => console.error("casting listing settlement failed", err));
  }

  if (paymentRecord.purpose === "CASTING_ACQUISITION_FEE" && paymentRecord.id) {
    await finalizeCastingHirePayment({
      id: paymentRecord.id,
      userId: paymentRecord.userId ?? null,
      relatedEntityId: paymentRecord.relatedEntityId,
      metadata: paymentRecord.metadata,
    }).catch((err: unknown) => console.error("casting hire settlement failed", err));
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
