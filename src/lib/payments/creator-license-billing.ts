import { prisma } from "@/lib/prisma";
import {
  addBillingPeriod,
  creatorLicenseRenewalPurpose,
  getCreatorLicenseBillingInterval,
  getCreatorLicenseRenewalPrice,
  isRecurringChargeDue,
  isRenewableCreatorLicenseType,
} from "@/lib/payments/billing-interval";
import { chargeUserSavedCard } from "@/lib/payments/charge-saved-card";
import {
  buildRecurringBillingFailureUpdate,
  buildRecurringBillingPendingUpdate,
} from "@/lib/payments/recurring-billing-shared";

const db = prisma as any;

async function finalizeCreatorLicenseCancellationsAtPeriodEnd(now: Date) {
  await db.creatorDistributionLicense.updateMany({
    where: {
      cancelAtPeriodEnd: true,
      status: "ACTIVE",
      yearlyExpiresAt: { lte: now },
    },
    data: { status: "CANCELLED", cancelAtPeriodEnd: false, autoRenew: false, lastPaymentError: null },
  });
}

export async function processCreatorLicenseRenewal(licenseId: string) {
  const now = new Date();
  const license = await db.creatorDistributionLicense.findUnique({
    where: { id: licenseId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!license) return { ok: false as const, reason: "license_not_found" };
  if (!isRenewableCreatorLicenseType(license.type)) {
    return { ok: false as const, reason: "not_renewable" };
  }
  if (license.cancelAtPeriodEnd || license.autoRenew === false) {
    return { ok: false as const, reason: "cancel_scheduled" };
  }

  const amount = getCreatorLicenseRenewalPrice(license.type);
  if (amount == null || amount <= 0) return { ok: false as const, reason: "no_price" };

  const charge = await chargeUserSavedCard({
    userId: license.userId,
    email: license.user?.email,
    amount,
    purpose: creatorLicenseRenewalPurpose(license.type),
    referenceType: "CreatorDistributionLicense",
    referenceId: license.id,
    gatewayReferencePrefix: "pf-lic-renew",
    metadata: { licenseType: license.type },
  });

  if (charge.ok) return { ok: true as const };

  if (charge.status === "PENDING") {
    await db.creatorDistributionLicense.update({
      where: { id: license.id },
      data: {
        ...buildRecurringBillingPendingUpdate(now),
        lastPaymentStatus: "PENDING",
      },
    });
    return { ok: false as const, reason: "charge_pending", paymentRecordId: charge.paymentRecordId };
  }

  await db.creatorDistributionLicense.update({
    where: { id: license.id },
    data: {
      ...buildRecurringBillingFailureUpdate({
        now,
        pastDueSince: license.pastDueSince,
        renewalAttemptCount: license.renewalAttemptCount,
        paymentStatus: charge.status,
        errorMessage:
          charge.reason === "missing_card_consent"
            ? "Add a PayFast card in wallet settings to renew your creator license."
            : charge.message,
      }),
      lastPaymentStatus: charge.status,
    },
  });
  return { ok: false as const, reason: charge.reason, message: charge.message };
}

export async function processDueCreatorLicenseRenewals(now = new Date()) {
  await finalizeCreatorLicenseCancellationsAtPeriodEnd(now);

  const candidates = await db.creatorDistributionLicense.findMany({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE"] },
      autoRenew: true,
      cancelAtPeriodEnd: false,
    },
    select: {
      id: true,
      type: true,
      status: true,
      autoRenew: true,
      cancelAtPeriodEnd: true,
      yearlyExpiresAt: true,
      pastDueSince: true,
      renewalAttemptCount: true,
      lastPaymentAt: true,
    },
    take: 500,
  });

  const due = candidates.filter(
    (row: (typeof candidates)[number]) =>
      isRenewableCreatorLicenseType(row.type) && isRecurringChargeDue(row, now),
  );
  const results = await Promise.all(
    due.map((license: { id: string }) => processCreatorLicenseRenewal(license.id)),
  );
  return { processed: due.length, succeeded: results.filter((r) => r.ok).length, results };
}

export async function cancelCreatorLicenseRenewal(userId: string, cancelAtPeriodEnd: boolean) {
  const license = await db.creatorDistributionLicense.findUnique({ where: { userId } });
  if (!license) return { ok: false as const, error: "License not found." };

  if (!cancelAtPeriodEnd) {
    const updated = await db.creatorDistributionLicense.update({
      where: { id: license.id },
      data: {
        status: "CANCELLED",
        autoRenew: false,
        cancelAtPeriodEnd: false,
        lastPaymentError: null,
      },
    });
    return { ok: true as const, license: updated, immediate: true };
  }

  const updated = await db.creatorDistributionLicense.update({
    where: { id: license.id },
    data: { cancelAtPeriodEnd: true },
  });
  return { ok: true as const, license: updated, immediate: false };
}

export async function resumeCreatorLicenseRenewal(userId: string) {
  const license = await db.creatorDistributionLicense.findUnique({ where: { userId } });
  if (!license) return { ok: false as const, error: "License not found." };
  const updated = await db.creatorDistributionLicense.update({
    where: { id: license.id },
    data: { cancelAtPeriodEnd: false, autoRenew: true },
  });
  return { ok: true as const, license: updated };
}

/** Extend license period after successful renewal payment. */
export async function extendCreatorLicensePeriod(licenseId: string) {
  const license = await db.creatorDistributionLicense.findUnique({ where: { id: licenseId } });
  if (!license) return;
  const interval = getCreatorLicenseBillingInterval(license.type);
  if (!interval) return;
  const now = new Date();
  const base =
    license.yearlyExpiresAt && new Date(license.yearlyExpiresAt) > now
      ? new Date(license.yearlyExpiresAt)
      : now;
  await db.creatorDistributionLicense.update({
    where: { id: licenseId },
    data: {
      yearlyExpiresAt: addBillingPeriod(base, interval),
      status: "ACTIVE",
      lastPaymentStatus: "SUCCEEDED",
      lastPaymentAt: now,
      lastPaymentError: null,
      renewalAttemptCount: 0,
      pastDueSince: null,
    },
  });
}
