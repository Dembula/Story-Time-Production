import {
  DEFAULT_APPLE_COMMISSION_RATE,
  MARKETPLACE_TX_FEE_RATE,
  VIEWER_CREATOR_SPLIT,
  VIEWER_PLATFORM_SPLIT,
  roundMoney,
} from "@/lib/payments/config";

export type FinanceFeeRates = {
  appleCommissionRate: number;
  viewerCreatorSplit: number;
  viewerPlatformSplit: number;
  marketplaceFeeRate: number;
};

export function defaultFinanceFeeRates(): FinanceFeeRates {
  return {
    appleCommissionRate: DEFAULT_APPLE_COMMISSION_RATE,
    viewerCreatorSplit: VIEWER_CREATOR_SPLIT,
    viewerPlatformSplit: VIEWER_PLATFORM_SPLIT,
    marketplaceFeeRate: MARKETPLACE_TX_FEE_RATE,
  };
}

function clampRate(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function validateFinanceFeeRates(input: Partial<FinanceFeeRates>): {
  ok: true;
  values: FinanceFeeRates;
} | { ok: false; error: string } {
  const appleCommissionRate = clampRate(
    Number(input.appleCommissionRate ?? DEFAULT_APPLE_COMMISSION_RATE),
    0,
    0.5,
  );
  const viewerCreatorSplit = clampRate(Number(input.viewerCreatorSplit ?? VIEWER_CREATOR_SPLIT), 0, 1);
  const viewerPlatformSplit = clampRate(Number(input.viewerPlatformSplit ?? VIEWER_PLATFORM_SPLIT), 0, 1);
  const marketplaceFeeRate = clampRate(Number(input.marketplaceFeeRate ?? MARKETPLACE_TX_FEE_RATE), 0, 0.25);

  const splitSum = roundMoney(viewerCreatorSplit + viewerPlatformSplit);
  if (Math.abs(splitSum - 1) > 0.001) {
    return { ok: false, error: "Viewer creator + platform splits must sum to 1.0." };
  }

  return {
    ok: true,
    values: {
      appleCommissionRate,
      viewerCreatorSplit,
      viewerPlatformSplit,
      marketplaceFeeRate,
    },
  };
}

/** Net merchant proceeds after estimated Apple commission. */
export function applyAppleCommission(gross: number, appleCommissionRate = DEFAULT_APPLE_COMMISSION_RATE): {
  gross: number;
  fee: number;
  settlement: number;
  rate: number;
} {
  const g = roundMoney(Math.max(0, gross));
  const rate = clampRate(appleCommissionRate, 0, 0.5);
  const fee = roundMoney(g * rate);
  const settlement = roundMoney(g - fee);
  return { gross: g, fee, settlement, rate };
}

export function splitViewerRevenueWithRates(amount: number, rates: Pick<FinanceFeeRates, "viewerCreatorSplit" | "viewerPlatformSplit">) {
  const creator = roundMoney(amount * rates.viewerCreatorSplit);
  const platform = roundMoney(amount * rates.viewerPlatformSplit);
  const delta = roundMoney(amount - creator - platform);
  return {
    creator: roundMoney(creator + delta),
    platform,
  };
}
