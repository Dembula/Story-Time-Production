/**
 * Creator revenue + funds-clear clocks go live at midnight Africa/Johannesburg on 2026-09-18.
 * Payments before this never enter the clear countdown / creator-pool system.
 */
export const CREATOR_REVENUE_GO_LIVE_AT = new Date("2026-09-18T00:00:00+02:00");

/** Effective tracking start: connector value, else the fixed Sep 18 go-live. */
export function resolveCreatorRevenueTrackingStart(
  trackingStartedAt?: Date | string | null,
): Date {
  if (trackingStartedAt) {
    const d = new Date(trackingStartedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return CREATOR_REVENUE_GO_LIVE_AT;
}

export function isPaidAtOnOrAfterTrackingStart(
  paidAt: Date | string | null | undefined,
  trackingStartedAt?: Date | string | null,
): boolean {
  if (!paidAt) return false;
  const paid = new Date(paidAt);
  if (Number.isNaN(paid.getTime())) return false;
  return paid.getTime() >= resolveCreatorRevenueTrackingStart(trackingStartedAt).getTime();
}
