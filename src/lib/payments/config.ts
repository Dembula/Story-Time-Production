export const PAYMENT_CURRENCY = "ZAR";
export const PLATFORM_TX_FEE_RATE = 0.035;
export const VIEWER_CREATOR_SPLIT = 0.6;
export const VIEWER_PLATFORM_SPLIT = 0.4;
export const STITCH_PROVIDER = "STITCH";

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
