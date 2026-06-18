import { roundMoney } from "@/lib/payments/config";

/** SA VAT applied to PayFast transaction fees (excl. VAT → incl. VAT). */
export const PAYFAST_VAT_RATE = 0.15;

export type PayFastSettlementSource = "itn" | "estimated" | "demo";

export type PayFastFeeSchedule = {
  fixedExclVat: number;
  percentExclVat: number;
};

/** PayFast merchant fee schedules (excl. VAT) — Credit/Apple/Google/Amex vs Debit. */
export const PAYFAST_FEE_SCHEDULES = {
  card: { fixedExclVat: 2.0, percentExclVat: 0.032 },
  debit: { fixedExclVat: 2.0, percentExclVat: 0.035 },
} as const satisfies Record<string, PayFastFeeSchedule>;

export const PAYFAST_METHOD_LABELS: Record<string, string> = {
  cc: "Credit Card",
  dc: "Debit Card",
  ap: "Apple Pay",
  gp: "Google Pay",
  sp: "Samsung Pay",
  ef: "EFT",
  mp: "Masterpass",
  mc: "Mobicred",
  sc: "SCode",
  ss: "SnapScan",
  zp: "Zapper",
  mt: "MoreTyme",
  rc: "Store card",
  mu: "Mukuru",
  cp: "Capitec Pay",
  ab: "Absa Pay",
  nd: "Nedbank Direct EFT",
  pf: "Payflex",
};

function feeScheduleForMethod(methodCode: string | null | undefined): PayFastFeeSchedule {
  const code = normalizePayFastMethodCode(methodCode);
  if (code === "dc") return PAYFAST_FEE_SCHEDULES.debit;
  return PAYFAST_FEE_SCHEDULES.card;
}

/** Map PayFast ITN / saved-card labels to a 2-letter method code. */
export function normalizePayFastMethodCode(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return "cc";
  if (value.length <= 3 && /^[a-z]{2,3}$/.test(value)) return value;
  if (value.includes("debit")) return "dc";
  if (value.includes("apple")) return "ap";
  if (value.includes("google")) return "gp";
  if (value.includes("amex") || value.includes("american express")) return "cc";
  if (value.includes("credit")) return "cc";
  return "cc";
}

export function payFastMethodLabel(methodCode: string | null | undefined): string {
  const code = normalizePayFastMethodCode(methodCode);
  return PAYFAST_METHOD_LABELS[code] ?? code.toUpperCase();
}

/** Estimate PayFast fee from gross amount and payment method (incl. VAT). */
export function estimatePayFastFee(grossAmount: number, methodCode: string | null | undefined): number {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0;
  const schedule = feeScheduleForMethod(methodCode);
  const feeExclVat = schedule.fixedExclVat + grossAmount * schedule.percentExclVat;
  return roundMoney(feeExclVat * (1 + PAYFAST_VAT_RATE));
}

export function estimatePayFastSettlement(grossAmount: number, methodCode: string | null | undefined): number {
  return roundMoney(Math.max(0, grossAmount - estimatePayFastFee(grossAmount, methodCode)));
}

export type PayFastSettlementBreakdown = {
  amountGross: number;
  providerFeeAmount: number;
  settlementAmount: number;
  providerPaymentMethod: string | null;
  providerPaymentMethodLabel: string;
  settlementSource: PayFastSettlementSource;
};

function parseMoneyField(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? roundMoney(n) : null;
}

/**
 * Resolve treasury settlement from PayFast ITN fields.
 * Prefers `amount_net` / `amount_fee` from ITN; falls back to fee schedule estimate.
 */
export function parsePayFastSettlementFromItn(
  data: Record<string, string>,
  fallbackGross?: number,
): PayFastSettlementBreakdown {
  const gross =
    parseMoneyField(data.amount_gross) ??
    parseMoneyField(data.amount) ??
    (fallbackGross != null ? roundMoney(fallbackGross) : 0);

  const methodCode = normalizePayFastMethodCode(data.payment_method);
  const methodLabel = payFastMethodLabel(methodCode);

  const rawFee = parseMoneyField(data.amount_fee);
  const feeFromItn = rawFee != null ? roundMoney(Math.abs(rawFee)) : null;
  const netFromItn = parseMoneyField(data.amount_net);

  if (netFromItn != null && netFromItn > 0) {
    const fee =
      feeFromItn != null && feeFromItn > 0
        ? feeFromItn
        : roundMoney(Math.max(0, gross - netFromItn));
    return {
      amountGross: gross,
      providerFeeAmount: fee,
      settlementAmount: netFromItn,
      providerPaymentMethod: data.payment_method?.trim() || methodCode,
      providerPaymentMethodLabel: methodLabel,
      settlementSource: "itn",
    };
  }

  const estimatedFee = estimatePayFastFee(gross, methodCode);
  return {
    amountGross: gross,
    providerFeeAmount: estimatedFee,
    settlementAmount: estimatePayFastSettlement(gross, methodCode),
    providerPaymentMethod: data.payment_method?.trim() || methodCode,
    providerPaymentMethodLabel: methodLabel,
    settlementSource: "estimated",
  };
}

export function demoPayFastSettlement(grossAmount: number): PayFastSettlementBreakdown {
  return {
    amountGross: roundMoney(grossAmount),
    providerFeeAmount: 0,
    settlementAmount: roundMoney(grossAmount),
    providerPaymentMethod: "demo",
    providerPaymentMethodLabel: "Demo (no gateway fee)",
    settlementSource: "demo",
  };
}

/** Amount that should flow into treasury / creator-pool splits (net after PayFast fees). */
export function getPaymentSettlementAmount(payment: {
  amount: number;
  settlementAmount?: number | null;
}): number {
  if (payment.settlementAmount != null && Number.isFinite(payment.settlementAmount) && payment.settlementAmount > 0) {
    return roundMoney(payment.settlementAmount);
  }
  return roundMoney(payment.amount);
}
