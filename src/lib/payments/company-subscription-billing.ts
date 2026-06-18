import { prisma } from "@/lib/prisma";
import {
  addBillingPeriod,
  getCompanyPlanPrice,
  isRecurringChargeDue,
} from "@/lib/payments/billing-interval";
import { chargeUserSavedCard } from "@/lib/payments/charge-saved-card";
import {
  buildRecurringBillingFailureUpdate,
  buildRecurringBillingPendingUpdate,
} from "@/lib/payments/recurring-billing-shared";

const db = prisma as any;

async function finalizeCompanyCancellationsAtPeriodEnd(now: Date) {
  await db.companySubscription.updateMany({
    where: {
      cancelAtPeriodEnd: true,
      status: "ACTIVE",
      currentPeriodEnd: { lte: now },
    },
    data: { status: "CANCELLED", cancelAtPeriodEnd: false, lastPaymentError: null },
  });
}

export async function processCompanySubscriptionCharge(subscriptionId: string) {
  const now = new Date();
  const subscription = await db.companySubscription.findUnique({
    where: { id: subscriptionId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!subscription) return { ok: false as const, reason: "subscription_not_found" };
  if (subscription.cancelAtPeriodEnd) return { ok: false as const, reason: "cancel_scheduled" };

  const amount = getCompanyPlanPrice(subscription.plan);

  const charge = await chargeUserSavedCard({
    userId: subscription.userId,
    email: subscription.user?.email ?? subscription.billingEmail,
    amount,
    purpose: "company_subscription_renewal",
    referenceType: "CompanySubscription",
    referenceId: subscription.id,
    gatewayReferencePrefix: "pf-co-renew",
    metadata: { plan: subscription.plan, companyType: subscription.companyType },
  });

  if (charge.ok) return { ok: true as const };

  if (charge.status === "PENDING") {
    await db.companySubscription.update({
      where: { id: subscription.id },
      data: buildRecurringBillingPendingUpdate(now),
    });
    return { ok: false as const, reason: "charge_pending", paymentRecordId: charge.paymentRecordId };
  }

  await db.companySubscription.update({
    where: { id: subscription.id },
    data: buildRecurringBillingFailureUpdate({
      now,
      pastDueSince: subscription.pastDueSince,
      renewalAttemptCount: subscription.renewalAttemptCount,
      paymentStatus: charge.status,
      errorMessage:
        charge.reason === "missing_card_consent"
          ? "Add a PayFast card in wallet settings to renew your company listing."
          : charge.message,
    }),
  });
  return { ok: false as const, reason: charge.reason, message: charge.message };
}

export async function processDueCompanySubscriptions(now = new Date()) {
  await finalizeCompanyCancellationsAtPeriodEnd(now);

  const candidates = await db.companySubscription.findMany({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE"] },
      cancelAtPeriodEnd: false,
    },
    select: {
      id: true,
      status: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
      pastDueSince: true,
      renewalAttemptCount: true,
      lastPaymentAt: true,
    },
    take: 500,
  });

  const due = candidates.filter((row: (typeof candidates)[number]) => isRecurringChargeDue(row, now));
  const results = await Promise.all(
    due.map((sub: { id: string }) => processCompanySubscriptionCharge(sub.id)),
  );
  return { processed: due.length, succeeded: results.filter((r) => r.ok).length, results };
}

export async function cancelCompanySubscription(args: {
  userId: string;
  companyType: string;
  cancelAtPeriodEnd: boolean;
}) {
  const subscription = await db.companySubscription.findFirst({
    where: { userId: args.userId, companyType: args.companyType },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) return { ok: false as const, error: "Subscription not found." };

  if (!args.cancelAtPeriodEnd) {
    const updated = await db.companySubscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED", cancelAtPeriodEnd: false },
    });
    return { ok: true as const, subscription: updated, immediate: true };
  }

  const updated = await db.companySubscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true },
  });
  return { ok: true as const, subscription: updated, immediate: false };
}

export async function resumeCompanySubscription(userId: string, companyType: string) {
  const subscription = await db.companySubscription.findFirst({
    where: { userId, companyType },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) return { ok: false as const, error: "Subscription not found." };
  const updated = await db.companySubscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: false },
  });
  return { ok: true as const, subscription: updated };
}

/** Extend company listing period after successful payment (monthly). */
export function nextCompanyPeriodEnd(from: Date, isRenewal: boolean, currentPeriodEnd: Date | null): Date {
  if (isRenewal && currentPeriodEnd && currentPeriodEnd > from) {
    return addBillingPeriod(currentPeriodEnd, "month");
  }
  return addBillingPeriod(from, "month");
}
