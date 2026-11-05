import "server-only";

import { applyAppleCommission, getFinanceFeeSettings } from "@/lib/finance/fee-settings";
import { roundMoney } from "@/lib/payments/config";

export type GoogleSettlementFields = {
  providerFeeAmount: number;
  settlementAmount: number;
  settlementSource: "google_estimated" | "google_proceeds" | "google_play" | "google_play_console";
  metadataExtras: Record<string, unknown>;
};

/**
 * Resolve Google Play fee + net settlement.
 * Uses the same editable Apple/store commission % unless explicit proceeds are provided.
 */
export async function resolveGooglePlaySettlement(options: {
  gross: number;
  proceedsAmount?: number | null;
  source?: "play_billing" | "console_remittance";
}): Promise<GoogleSettlementFields> {
  const gross = roundMoney(Math.max(0, options.gross));
  const proceeds =
    options.proceedsAmount != null && Number.isFinite(options.proceedsAmount)
      ? roundMoney(Math.max(0, Number(options.proceedsAmount)))
      : null;

  if (proceeds != null && proceeds <= gross + 0.001) {
    const fee = roundMoney(Math.max(0, gross - proceeds));
    const consoleImport = options.source === "console_remittance";
    return {
      providerFeeAmount: fee,
      settlementAmount: proceeds,
      settlementSource: consoleImport ? "google_play_console" : "google_proceeds",
      metadataExtras: {
        googleSettlementMode: consoleImport ? "console_proceeds" : "proceeds",
        googleGross: gross,
        googleProceeds: proceeds,
        googleFee: fee,
      },
    };
  }

  const settings = await getFinanceFeeSettings();
  const applied = applyAppleCommission(gross, settings.appleCommissionRate);
  return {
    providerFeeAmount: applied.fee,
    settlementAmount: applied.settlement,
    settlementSource: "google_estimated",
    metadataExtras: {
      googleSettlementMode: "estimated_commission",
      googleCommissionRate: applied.rate,
      googleGross: applied.gross,
      googleFee: applied.fee,
      googleSettlement: applied.settlement,
    },
  };
}
