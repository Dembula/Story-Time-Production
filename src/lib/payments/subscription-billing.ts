import { prisma } from "@/lib/prisma";
import { VIEWER_PLAN_CONFIG } from "@/lib/viewer-access";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { toGatewaySafeReference } from "@/lib/payments/reference";

const db = prisma as any;

function planAmount(plan: string) {
  return VIEWER_PLAN_CONFIG[plan as keyof typeof VIEWER_PLAN_CONFIG]?.price ?? VIEWER_PLAN_CONFIG.BASE_1.price;
}

function add30Days(base: Date) {
  return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
}

export async function processViewerSubscriptionCharge(subscriptionId: string) {
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
  if (!subscription.externalPaymentId) {
    return { ok: false as const, reason: "missing_card_consent" };
  }

  const amount = planAmount(subscription.plan);
  const paymentRecord = await db.paymentRecord.create({
    data: {
      userId: subscription.userId,
      provider: "STITCH",
      purpose: "viewer_subscription_renewal",
      status: "PENDING",
      amount,
      currency: "ZAR",
      email: subscription.user?.email ?? null,
      relatedEntityType: "ViewerSubscription",
      relatedEntityId: subscription.id,
      metadata: { source: "subscription_auto_charge", plan: subscription.plan },
    },
  });

  const gateway = getPaymentGateway();
  try {
    const charge = await gateway.chargeSavedCard({
      consentReference: subscription.externalPaymentId,
      amount,
      currency: "ZAR",
      reference: toGatewaySafeReference("st-renew", paymentRecord.id),
    });

    await db.gatewayReference.create({
      data: {
        provider: charge.provider,
        referenceType: "ViewerSubscription",
        referenceId: subscription.id,
        externalRef: charge.externalRef,
        metadata: { paymentRecordId: paymentRecord.id, source: "auto_renewal" },
      },
    });

    if (charge.status !== "COMPLETED") {
      await db.paymentRecord.update({
        where: { id: paymentRecord.id },
        data: { status: charge.status === "FAILED" ? "FAILED" : "PENDING" },
      });
      await db.viewerSubscription.update({
        where: { id: subscription.id },
        data: { status: "PAST_DUE", lastPaymentStatus: charge.status, lastPaymentAt: new Date() },
      });
      return { ok: false as const, reason: "charge_not_completed" };
    }

    const now = new Date();
    const base = subscription.currentPeriodEnd && subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
    await db.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: { status: "SUCCEEDED", paidAt: now },
    });
    await db.viewerSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        currentPeriodEnd: add30Days(base),
        lastPaymentStatus: "SUCCEEDED",
        lastPaymentAt: now,
        lastPaymentError: null,
      },
    });
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automatic charge failed.";
    await db.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: { status: "FAILED", metadata: { ...(paymentRecord.metadata ?? {}), chargeError: message } },
    });
    await db.viewerSubscription.update({
      where: { id: subscription.id },
      data: { status: "PAST_DUE", lastPaymentStatus: "FAILED", lastPaymentError: message, lastPaymentAt: new Date() },
    });
    return { ok: false as const, reason: "charge_failed", message };
  }
}

export async function processDueViewerTrials() {
  const dueTrials = await db.viewerSubscription.findMany({
    where: {
      viewerModel: "SUBSCRIPTION",
      status: "TRIAL_ACTIVE",
      trialEndsAt: { lte: new Date() },
    },
    select: { id: true },
    take: 200,
  });

  const results = await Promise.all(
    dueTrials.map((sub: { id: string }) => processViewerSubscriptionCharge(sub.id)),
  );
  return { processed: dueTrials.length, succeeded: results.filter((r) => r.ok).length };
}
