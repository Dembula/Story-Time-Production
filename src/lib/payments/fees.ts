import {
  MARKETPLACE_TX_FEE_RATE,
  PLATFORM_TX_FEE_RATE,
  VIEWER_CREATOR_SPLIT,
  VIEWER_PLATFORM_SPLIT,
  roundMoney,
} from "@/lib/payments/config";
import { splitViewerRevenueWithRates } from "@/lib/finance/fee-math";

export function calculatePlatformTransactionFee(amount: number): number {
  return roundMoney(amount * PLATFORM_TX_FEE_RATE);
}

export function calculateMarketplaceTransactionFee(baseAmount: number, rate = MARKETPLACE_TX_FEE_RATE): number {
  return roundMoney(baseAmount * rate);
}

export function splitViewerRevenue(
  amount: number,
  rates?: { viewerCreatorSplit?: number; viewerPlatformSplit?: number },
) {
  return splitViewerRevenueWithRates(amount, {
    viewerCreatorSplit: rates?.viewerCreatorSplit ?? VIEWER_CREATOR_SPLIT,
    viewerPlatformSplit: rates?.viewerPlatformSplit ?? VIEWER_PLATFORM_SPLIT,
  });
}

export function netAfterPlatformFee(amount: number) {
  const fee = calculatePlatformTransactionFee(amount);
  return { fee, net: roundMoney(amount - fee) };
}
