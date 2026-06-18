import "server-only";

import {
  DUNNING_RETRY_DAYS_AFTER_FAILURE,
  MAX_BILLING_ATTEMPTS,
  type BillingInterval,
} from "@/lib/payments/billing-interval";

export type RecurringBillingFailureUpdate = {
  status: "PAST_DUE";
  lastPaymentStatus: string;
  lastPaymentError: string | null;
  lastPaymentAt: Date;
  pastDueSince: Date;
  renewalAttemptCount: number;
};

export function buildRecurringBillingFailureUpdate(args: {
  now: Date;
  pastDueSince?: Date | null;
  renewalAttemptCount?: number;
  paymentStatus: string;
  errorMessage?: string | null;
}): RecurringBillingFailureUpdate {
  const attempts = (args.renewalAttemptCount ?? 0) + 1;
  return {
    status: "PAST_DUE",
    lastPaymentStatus: args.paymentStatus,
    lastPaymentError:
      args.errorMessage ??
      (attempts >= MAX_BILLING_ATTEMPTS
        ? "Payment failed after multiple attempts. Update your card or pay manually to restore access."
        : `Payment failed. We will retry in ${DUNNING_RETRY_DAYS_AFTER_FAILURE[attempts - 1] ?? "a few"} days.`),
    lastPaymentAt: args.now,
    pastDueSince: args.pastDueSince ?? args.now,
    renewalAttemptCount: attempts,
  };
}

export function buildRecurringBillingPendingUpdate(now: Date) {
  return {
    lastPaymentStatus: "PENDING",
    lastPaymentError: null,
    lastPaymentAt: now,
  };
}

export function buildRecurringBillingSuccessReset() {
  return {
    renewalAttemptCount: 0,
    pastDueSince: null,
    lastPaymentError: null,
  };
}

export function recurringRenewalPurpose(basePurpose: string, interval: BillingInterval): string {
  return `${basePurpose}_renewal`;
}
