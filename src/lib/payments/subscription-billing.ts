import { prisma } from "@/lib/prisma";
import { VIEWER_PLAN_CONFIG } from "@/lib/viewer-access";
import { isViewerSubscriptionChargeDue } from "@/lib/payments/billing-interval";
import { chargeUserSavedCard } from "@/lib/payments/charge-saved-card";
import { hasPendingRenewalPayment } from "@/lib/payments/pending-renewal-payment";
import {
  buildRecurringBillingFailureUpdate,
  buildRecurringBillingPendingUpdate,
} from "@/lib/payments/recurring-billing-shared";

const db = prisma as any;

function planAmount(plan: string) {
  return VIEWER_PLAN_CONFIG[plan as keyof typeof VIEWER_PLAN_CONFIG]?.price ?? VIEWER_PLAN_CONFIG.BASE_1.price;
}

async function finalizeViewerCancellationsAtPeriodEnd(now: Date) {
  await db.viewerSubscription.updateMany({
    where: {
      viewerModel: "SUBSCRIPTION",
      cancelAtPeriodEnd: true,
      status: "ACTIVE",
      currentPeriodEnd: { lte: now },
    },
    data: { status: "CANCELLED", cancelAtPeriodEnd: false, lastPaymentError: null },
  });
  await db.viewerSubscription.updateMany({
    where: {
      viewerModel: "SUBSCRIPTION",
      cancelAtPeriodEnd: true,
      status: "TRIAL_ACTIVE",
      trialEndsAt: { lte: now },
    },
    data: { status: "CANCELLED", cancelAtPeriodEnd: false, lastPaymentError: null },
  });
}

export async function processViewerSubscriptionCharge(subscriptionId: string) {
  const now = new Date();
  const subscription = await db.viewerSubscription.findUnique({
    where: { id: subscriptionId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!subscription) {
    return { ok: false as const, reason: "subscription_not_found" };
  }
  if (subscription.viewerModel !== "SUBSCRIPTION") {
    return { ok: false as const, reason: "not_subscription_model" };
  }
  if (subscription.cancelAtPeriodEnd) {
    return { ok: false as const, reason: "cancel_scheduled" };
  }

  if (await hasPendingRenewalPayment("ViewerSubscription", subscription.id)) {
    return { ok: false as const, reason: "payment_already_pending" };
  }

  const amount = planAmount(subscription.plan);
  const purpose =
    subscription.status === "TRIAL_ACTIVE" ? "viewer_subscription" : "viewer_subscription_renewal";

  const charge = await chargeUserSavedCard({
    userId: subscription.userId,
    email: subscription.user?.email,
    amount,
    purpose,
    referenceType: "ViewerSubscription",
    referenceId: subscription.id,
    gatewayReferencePrefix: "pf-renew",
    metadata: { plan: subscription.plan, source: "auto_renewal" },
  });

  if (charge.ok) {
    return { ok: true as const };
  }

  if (charge.status === "PENDING") {
    await db.viewerSubscription.update({
      where: { id: subscription.id },
      data: buildRecurringBillingPendingUpdate(now),
    });
    return { ok: false as const, reason: "charge_pending", paymentRecordId: charge.paymentRecordId };
  }

  if (charge.reason === "missing_card_consent") {
    await db.viewerSubscription.update({
      where: { id: subscription.id },
      data: buildRecurringBillingFailureUpdate({
        now,
        pastDueSince: subscription.pastDueSince,
        renewalAttemptCount: subscription.renewalAttemptCount,
        paymentStatus: "FAILED",
        errorMessage: "Add a PayFast card to continue your subscription.",
      }),
    });
    return { ok: false as const, reason: "missing_card_consent" };
  }

  await db.viewerSubscription.update({
    where: { id: subscription.id },
    data: buildRecurringBillingFailureUpdate({
      now,
      pastDueSince: subscription.pastDueSince,
      renewalAttemptCount: subscription.renewalAttemptCount,
      paymentStatus: charge.status,
      errorMessage: charge.message,
    }),
  });
  return { ok: false as const, reason: charge.reason, message: charge.message };
}

export async function processDueViewerBilling(now = new Date()) {
  await finalizeViewerCancellationsAtPeriodEnd(now);

  const lookaheadEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const candidates = await db.viewerSubscription.findMany({
    where: {
      viewerModel: "SUBSCRIPTION",
      cancelAtPeriodEnd: false,
      status: { in: ["TRIAL_ACTIVE", "ACTIVE", "PAST_DUE"] },
      OR: [
        { status: "TRIAL_ACTIVE", trialEndsAt: { lte: now } },
        {
          status: "ACTIVE",
          OR: [{ currentPeriodEnd: { lte: lookaheadEnd } }, { currentPeriodEnd: null }],
        },
        { status: "PAST_DUE" },
      ],
    },
    select: {
      id: true,
      viewerModel: true,
      status: true,
      cancelAtPeriodEnd: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      pastDueSince: true,
      renewalAttemptCount: true,
      lastPaymentAt: true,
    },
    take: 500,
  });

  const due = candidates.filter((row: (typeof candidates)[number]) =>
    isViewerSubscriptionChargeDue(row, now),
  );

  const results: Awaited<ReturnType<typeof processViewerSubscriptionCharge>>[] = [];
  for (const sub of due) {
    results.push(await processViewerSubscriptionCharge(sub.id));
  }

  return {
    processed: due.length,
    succeeded: results.filter((r) => r.ok).length,
    results,
  };
}

/** @deprecated Use processDueViewerBilling */
export async function processDueViewerTrials() {
  const result = await processDueViewerBilling();
  return { processed: result.processed, succeeded: result.succeeded };
}

export async function cancelViewerSubscription(args: {
  userId: string;
  cancelAtPeriodEnd: boolean;
}) {
  const subscription = await db.viewerSubscription.findFirst({
    where: { userId: args.userId, viewerModel: "SUBSCRIPTION" },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) {
    return { ok: false as const, error: "Subscription not found." };
  }
  if (subscription.status === "CANCELLED") {
    return { ok: true as const, subscription };
  }

  if (!args.cancelAtPeriodEnd) {
    const updated = await db.viewerSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "CANCELLED",
        cancelAtPeriodEnd: false,
        lastPaymentError: null,
      },
    });
    return { ok: true as const, subscription: updated, immediate: true };
  }

  const updated = await db.viewerSubscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true },
  });
  return { ok: true as const, subscription: updated, immediate: false };
}

export async function resumeViewerSubscription(userId: string) {
  const subscription = await db.viewerSubscription.findFirst({
    where: { userId, viewerModel: "SUBSCRIPTION" },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) return { ok: false as const, error: "Subscription not found." };
  const updated = await db.viewerSubscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: false },
  });
  return { ok: true as const, subscription: updated };
}
