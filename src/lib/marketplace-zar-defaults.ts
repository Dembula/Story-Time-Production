/** Client-safe defaults — must match `crew-team/requests/[id]/pay` and `casting-agency/inquiries/[id]/pay`. */
export const DEFAULT_CREW_TEAM_REQUEST_BASE_ZAR = 1200;

export const DEFAULT_CASTING_INQUIRY_BASE_ZAR = 800;

/** Simulated marketplace fee (3%) — same rule across marketplace + funding deals. */
export function computeMarketplaceFeeZar(baseAmount: number): number {
  return Math.round(baseAmount * 0.03 * 100) / 100;
}

/** Checkout totals shown to buyers (Story Time fee included; PayFast absorbed by platform). */
export function computeMarketplaceCheckoutTotals(baseAmount: number) {
  const feeAmount = computeMarketplaceFeeZar(baseAmount);
  const totalAmount = Math.round((baseAmount + feeAmount) * 100) / 100;
  return { baseAmount, feeAmount, totalAmount };
}
