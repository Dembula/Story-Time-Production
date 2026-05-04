import { PLATFORM_TX_FEE_RATE, VIEWER_CREATOR_SPLIT, VIEWER_PLATFORM_SPLIT, roundMoney } from "@/lib/payments/config";

export function calculatePlatformTransactionFee(amount: number): number {
  return roundMoney(amount * PLATFORM_TX_FEE_RATE);
}

export function splitViewerRevenue(amount: number) {
  const creator = roundMoney(amount * VIEWER_CREATOR_SPLIT);
  const platform = roundMoney(amount * VIEWER_PLATFORM_SPLIT);
  const delta = roundMoney(amount - creator - platform);
  return {
    creator: roundMoney(creator + delta),
    platform,
  };
}

export function netAfterPlatformFee(amount: number) {
  const fee = calculatePlatformTransactionFee(amount);
  return { fee, net: roundMoney(amount - fee) };
}
