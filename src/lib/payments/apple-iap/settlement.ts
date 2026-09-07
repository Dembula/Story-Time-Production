import "server-only";

import { applyAppleCommission, getFinanceFeeSettings } from "@/lib/finance/fee-settings";
import { roundMoney } from "@/lib/payments/config";

export type AppleSettlementFields = {
  providerFeeAmount: number;
  settlementAmount: number;
  settlementSource: "apple_estimated" | "apple_proceeds" | "apple_iap";
  metadataExtras: Record<string, unknown>;
};

/**
 * Resolve Apple fee + net settlement.
 * Prefer explicit App Store proceeds when provided; otherwise apply editable commission %.
 */
export async function resolveAppleSettlement(options: {
  gross: number;
  /** Net proceeds from App Store Connect / transaction if known. */
  proceedsAmount?: number | null;
}): Promise<AppleSettlementFields> {
  const gross = roundMoney(Math.max(0, options.gross));
  const proceeds =
    options.proceedsAmount != null && Number.isFinite(options.proceedsAmount)
      ? roundMoney(Math.max(0, Number(options.proceedsAmount)))
      : null;

  if (proceeds != null && proceeds <= gross) {
    const fee = roundMoney(gross - proceeds);
    return {
      providerFeeAmount: fee,
      settlementAmount: proceeds,
      settlementSource: "apple_proceeds",
      metadataExtras: {
        appleSettlementMode: "proceeds",
        appleGross: gross,
        appleProceeds: proceeds,
        appleFee: fee,
      },
    };
  }

  const settings = await getFinanceFeeSettings();
  const applied = applyAppleCommission(gross, settings.appleCommissionRate);
  return {
    providerFeeAmount: applied.fee,
    settlementAmount: applied.settlement,
    settlementSource: "apple_estimated",
    metadataExtras: {
      appleSettlementMode: "estimated_commission",
      appleCommissionRate: applied.rate,
      appleGross: applied.gross,
      appleFee: applied.fee,
      appleSettlement: applied.settlement,
    },
  };
}
