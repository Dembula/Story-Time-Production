import "server-only";

import { isCashRecognizedPayment } from "@/lib/payments/cash-recognition";
import { allocateGatewayPaymentLedger } from "@/lib/payments/gateway-allocation";

/** Book treasury ledger entries for a succeeded Apple IAP payment (production cash only). */
export async function bookAppleIapLedgerIfCash(payment: {
  id: string;
  amount: number;
  settlementAmount?: number;
  purpose: string;
  relatedEntityType: string;
  relatedEntityId: string;
  environment: string;
}) {
  const settlementAmount =
    payment.settlementAmount != null && Number.isFinite(payment.settlementAmount)
      ? payment.settlementAmount
      : payment.amount;

  const cashRecognized = isCashRecognizedPayment({
    status: "SUCCEEDED",
    amount: payment.amount,
    settlementAmount,
    provider: "APPLE",
    settlementSource: "apple_estimated",
    purpose: payment.purpose,
    metadata: { environment: payment.environment, source: "ios_app" },
  });

  if (!cashRecognized || !(settlementAmount > 0)) return;

  await allocateGatewayPaymentLedger({
    id: payment.id,
    amount: payment.amount,
    settlementAmount,
    purpose: payment.purpose,
    relatedEntityType: payment.relatedEntityType,
    relatedEntityId: payment.relatedEntityId,
  }).catch((err: unknown) => {
    console.error("apple_iap ledger allocation skipped", payment.id, err);
  });
}
