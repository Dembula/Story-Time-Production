import {
  CREATOR_LICENSE_TYPE,
  CREATOR_ONBOARDING_PLANS,
  getCompanyPlanConfig,
} from "@/lib/pricing";

export type BillingInterval = "month" | "year";

export const DUNNING_RETRY_DAYS_AFTER_FAILURE = [3, 7] as const;
export const MAX_BILLING_ATTEMPTS = 1 + DUNNING_RETRY_DAYS_AFTER_FAILURE.length;

export function addBillingPeriod(from: Date, interval: BillingInterval): Date {
  const next = new Date(from);
  if (interval === "year") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

/** Viewer subscriptions are monthly only. */
export function addViewerSubscriptionPeriod(from: Date): Date {
  return addBillingPeriod(from, "month");
}

export function getCompanyPlanPrice(plan: string): number {
  return getCompanyPlanConfig(plan).price;
}

export function getCreatorLicenseRenewalPrice(licenseType: string): number | null {
  switch (licenseType) {
    case CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY:
      return CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price;
    case CREATOR_LICENSE_TYPE.PIPELINE_YEARLY:
      return CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price;
    case CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY:
    case "CREATOR_UPLOAD_ONLY_R99_Y":
      return CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price;
    case "YEARLY":
    case "YEARLY_R89":
      return CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price;
    default:
      return null;
  }
}

export function getCreatorLicenseBillingInterval(licenseType: string): BillingInterval | null {
  if (licenseType === CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY) return "month";
  if (getCreatorLicenseRenewalPrice(licenseType) != null && licenseType !== CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY) {
    return "year";
  }
  return null;
}

export function isRenewableCreatorLicenseType(licenseType: string): boolean {
  return getCreatorLicenseBillingInterval(licenseType) != null;
}

export function creatorLicenseRenewalPurpose(licenseType: string): string {
  if (licenseType === CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY) return "creator_pipeline_monthly_renewal";
  if (licenseType === CREATOR_LICENSE_TYPE.PIPELINE_YEARLY) return "creator_pipeline_yearly_renewal";
  return "creator_upload_only_yearly_renewal";
}

/** Charge up to 24h before period end so viewers are not locked out waiting for cron. */
export const VIEWER_RENEWAL_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

export function isViewerRenewalPeriodDue(
  periodEnd: Date | string | null | undefined,
  now: Date,
  lookaheadMs = VIEWER_RENEWAL_LOOKAHEAD_MS,
): boolean {
  if (!periodEnd) return true;
  return new Date(periodEnd).getTime() <= now.getTime() + lookaheadMs;
}
type BillableRow = {
  status: string;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  yearlyExpiresAt?: Date | null;
  pastDueSince?: Date | null;
  renewalAttemptCount?: number;
  lastPaymentAt?: Date | null;
  autoRenew?: boolean;
  viewerModel?: string | null;
};

/** Whether a viewer subscription row should be auto-charged on this cron run. */
export function isViewerSubscriptionChargeDue(row: BillableRow, now: Date): boolean {
  if (row.viewerModel && row.viewerModel !== "SUBSCRIPTION") return false;
  if (row.cancelAtPeriodEnd) return false;

  if (row.status === "TRIAL_ACTIVE") {
    return !!row.trialEndsAt && new Date(row.trialEndsAt) <= now;
  }

  if (row.status === "ACTIVE") {
    return isViewerRenewalPeriodDue(row.currentPeriodEnd, now);
  }

  if (row.status === "PAST_DUE") {
    const attempts = row.renewalAttemptCount ?? 0;
    if (attempts <= 0 || attempts >= MAX_BILLING_ATTEMPTS) return false;
    if (!row.pastDueSince) return true;
    const retryDay = DUNNING_RETRY_DAYS_AFTER_FAILURE[attempts - 1];
    if (retryDay == null) return false;
    const dueAt = new Date(row.pastDueSince.getTime() + retryDay * 24 * 60 * 60 * 1000);
    if (now < dueAt) return false;
    if (row.lastPaymentAt && row.lastPaymentAt >= dueAt) return false;
    return true;
  }

  return false;
}

/** Whether a subscription/license row should be charged on this cron run. */
export function isRecurringChargeDue(row: BillableRow, now: Date): boolean {
  if (row.cancelAtPeriodEnd) return false;
  if (row.autoRenew === false) return false;

  if (row.status === "TRIAL_ACTIVE") {
    return !!row.trialEndsAt && new Date(row.trialEndsAt) <= now;
  }

  const periodEnd = row.currentPeriodEnd ?? row.yearlyExpiresAt;
  if (row.status === "ACTIVE") {
    return isViewerRenewalPeriodDue(periodEnd, now);
  }

  if (row.status === "PAST_DUE") {
    const attempts = row.renewalAttemptCount ?? 0;
    if (attempts <= 0 || attempts >= MAX_BILLING_ATTEMPTS) return false;
    if (!row.pastDueSince) return true;
    const retryDay = DUNNING_RETRY_DAYS_AFTER_FAILURE[attempts - 1];
    if (retryDay == null) return false;
    const dueAt = new Date(row.pastDueSince.getTime() + retryDay * 24 * 60 * 60 * 1000);
    if (now < dueAt) return false;
    if (row.lastPaymentAt && row.lastPaymentAt >= dueAt) return false;
    return true;
  }

  return false;
}
