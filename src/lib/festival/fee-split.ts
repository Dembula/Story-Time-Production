import { roundMoney } from "@/lib/payments/config";

/**
 * Festival submission fee split (curator signup is free).
 * Tunable later — keep constants in one place.
 */
export const FESTIVAL_CURATOR_SHARE = 0.85;
export const FESTIVAL_PLATFORM_SHARE = 0.15;

/** Split a festival submission settlement: Story Time take vs festival remittance. */
export function splitFestivalSubmissionSettlement(settlementAmount: number): {
  platformFeeZar: number;
  festivalNetZar: number;
  curatorShare: number;
  platformShare: number;
} {
  const festivalNetZar = roundMoney(Math.max(0, settlementAmount * FESTIVAL_CURATOR_SHARE));
  const platformFeeZar = roundMoney(Math.max(0, settlementAmount - festivalNetZar));
  return {
    platformFeeZar,
    festivalNetZar,
    curatorShare: FESTIVAL_CURATOR_SHARE,
    platformShare: FESTIVAL_PLATFORM_SHARE,
  };
}
