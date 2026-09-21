/** PayFast merchant settlements typically land in ~2–3 business days; we use calendar days. */
export const PAYFAST_FUNDS_CLEAR_DAYS = 3;
/** Apple App Store proceeds are typically remitted ~45 days after purchase. */
export const APPLE_FUNDS_CLEAR_DAYS = 45;

export type FundsClearMode = "auto" | "manual";

export function fundsClearDelayDaysForProvider(provider: string | null | undefined): number {
  const p = String(provider ?? "").toUpperCase();
  if (p === "APPLE") return APPLE_FUNDS_CLEAR_DAYS;
  if (p === "PAYFAST") return PAYFAST_FUNDS_CLEAR_DAYS;
  // Unknown live providers: treat like PayFast (faster) rather than holding 45 days.
  return PAYFAST_FUNDS_CLEAR_DAYS;
}

export function computeFundsClearDueAt(
  paidAt: Date,
  provider: string | null | undefined,
): Date {
  const days = fundsClearDelayDaysForProvider(provider);
  const due = new Date(paidAt.getTime());
  due.setUTCDate(due.getUTCDate() + days);
  return due;
}

export function isFundsCleared(payment: {
  fundsClearedAt?: Date | string | null;
}): boolean {
  return Boolean(payment.fundsClearedAt);
}

export function describeFundsClearStatus(payment: {
  provider?: string | null;
  paidAt?: Date | string | null;
  fundsClearDueAt?: Date | string | null;
  fundsClearedAt?: Date | string | null;
  fundsClearedMode?: string | null;
  /** When set, payments before this instant are excluded from clear clocks. */
  trackingStartedAt?: Date | string | null;
  now?: Date;
}): {
  status: "cleared" | "pending" | "not_applicable";
  label: string;
  daysRemaining: number | null;
  clearDueAt: string | null;
  clearedAt: string | null;
  clearDelayDays: number;
} {
  const clearDelayDays = fundsClearDelayDaysForProvider(payment.provider);
  if (!payment.paidAt) {
    return {
      status: "not_applicable",
      label: "Not paid",
      daysRemaining: null,
      clearDueAt: null,
      clearedAt: null,
      clearDelayDays,
    };
  }

  const paidAt = new Date(payment.paidAt);
  if (Number.isNaN(paidAt.getTime())) {
    return {
      status: "not_applicable",
      label: "Not paid",
      daysRemaining: null,
      clearDueAt: null,
      clearedAt: null,
      clearDelayDays,
    };
  }

  // Pre-tracking cash never enters the PayFast 3d / Apple 45d creator-revenue clear system.
  if (payment.trackingStartedAt != null) {
    const start = new Date(payment.trackingStartedAt);
    if (!Number.isNaN(start.getTime()) && paidAt.getTime() < start.getTime()) {
      return {
        status: "not_applicable",
        label: "Before tracking",
        daysRemaining: null,
        clearDueAt: null,
        clearedAt: null,
        clearDelayDays,
      };
    }
  }

  if (payment.fundsClearedAt) {
    const mode = payment.fundsClearedMode === "manual" ? "early clear" : "auto";
    return {
      status: "cleared",
      label: `Cleared (${mode})`,
      daysRemaining: 0,
      clearDueAt: payment.fundsClearDueAt
        ? new Date(payment.fundsClearDueAt).toISOString()
        : null,
      clearedAt: new Date(payment.fundsClearedAt).toISOString(),
      clearDelayDays,
    };
  }

  const now = payment.now ?? new Date();
  const due = payment.fundsClearDueAt
    ? new Date(payment.fundsClearDueAt)
    : computeFundsClearDueAt(paidAt, payment.provider);
  const ms = due.getTime() - now.getTime();
  // Whole calendar days left until the clear-due instant (ceil so "day 0" means due/past).
  const daysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  const providerTag =
    String(payment.provider ?? "").toUpperCase() === "APPLE"
      ? `Apple ${clearDelayDays}d`
      : String(payment.provider ?? "").toUpperCase() === "PAYFAST"
        ? `PayFast ${clearDelayDays}d`
        : `${clearDelayDays}d`;
  return {
    status: "pending",
    label:
      daysRemaining <= 0
        ? `Due to clear · ${providerTag}`
        : `Clears in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} · ${providerTag}`,
    daysRemaining,
    clearDueAt: due.toISOString(),
    clearedAt: null,
    clearDelayDays,
  };
}
