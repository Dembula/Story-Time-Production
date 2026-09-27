import type { AppleTransactionPayload } from "@/lib/payments/apple-iap/jws";

/** Products configured with an introductory free trial in App Store / Play Console. */
export const STORE_FREE_TRIAL_PRODUCT_IDS = new Set([
  // Universe iOS (App Store)
  "com.storytime.universe.sub.base.monthly",
  "com.storytime.universe.sub.base.yearly",
  // Universe Android (Play)
  "stu.sub.base.monthly",
  "stu.sub.base.yearly",
  // Creators iOS / Android — pipeline monthly intro offer
  "online.storytime.creators.sub.pipeline.monthly",
]);

export const DEFAULT_STORE_FREE_TRIAL_DAYS = 7;

export type StoreFreeTrialInfo = {
  isFreeTrial: boolean;
  /** When the intro/trial period ends (exclusive of paid period). */
  trialEndsAt: Date | null;
  offerType?: number | null;
  offerDiscountType?: string | null;
  source: "apple_jws" | "google_client" | "product_default" | "none";
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Detect App Store introductory free trial from a verified StoreKit 2 / ASN transaction.
 * Prefer offerDiscountType / offerType; fall back to zero price on known trial products.
 */
export function detectAppleStoreFreeTrial(
  payload: AppleTransactionPayload,
  options?: { now?: Date },
): StoreFreeTrialInfo {
  const now = options?.now ?? new Date();
  const productId = String(payload.productId ?? "").trim();
  const offerDiscountType =
    typeof payload.offerDiscountType === "string"
      ? payload.offerDiscountType.toUpperCase()
      : null;
  const offerType = asNumber(payload.offerType);
  const price = asNumber(payload.price);
  const expiresAt =
    typeof payload.expiresDate === "number" && payload.expiresDate > 0
      ? new Date(payload.expiresDate)
      : null;

  const explicitFreeTrial =
    offerDiscountType === "FREE_TRIAL" ||
    // Introductory offer (1) with zero millunit price
    (offerType === 1 && price === 0);

  const likelyFreeTrial =
    explicitFreeTrial ||
    (price === 0 &&
      STORE_FREE_TRIAL_PRODUCT_IDS.has(productId) &&
      String(payload.transactionReason ?? "PURCHASE").toUpperCase() !== "RENEWAL");

  if (!likelyFreeTrial) {
    return {
      isFreeTrial: false,
      trialEndsAt: null,
      offerType,
      offerDiscountType,
      source: "none",
    };
  }

  const trialEndsAt =
    expiresAt && expiresAt.getTime() > now.getTime()
      ? expiresAt
      : addDays(now, DEFAULT_STORE_FREE_TRIAL_DAYS);

  return {
    isFreeTrial: true,
    trialEndsAt,
    offerType,
    offerDiscountType,
    source: explicitFreeTrial ? "apple_jws" : "product_default",
  };
}

/** Google Play activate body hint (client-reported until Play Developer API verify is wired). */
export function detectGoogleStoreFreeTrial(input: {
  productId?: string | null;
  isFreeTrial?: boolean | null;
  freeTrial?: boolean | null;
  offerId?: string | null;
  trialEndsAt?: string | Date | null;
  now?: Date;
}): StoreFreeTrialInfo {
  const now = input.now ?? new Date();
  const productId = String(input.productId ?? "").trim();
  const offerId = String(input.offerId ?? "").toLowerCase();
  const flagged =
    input.isFreeTrial === true ||
    input.freeTrial === true ||
    offerId.includes("trial") ||
    offerId.includes("freetrial") ||
    offerId.includes("free-trial");

  if (!flagged && !STORE_FREE_TRIAL_PRODUCT_IDS.has(productId)) {
    return { isFreeTrial: false, trialEndsAt: null, source: "none" };
  }
  if (!flagged && STORE_FREE_TRIAL_PRODUCT_IDS.has(productId)) {
    // Don't invent a trial without a client/Google signal — Play base plans may or may not include one.
    return { isFreeTrial: false, trialEndsAt: null, source: "none" };
  }

  let trialEndsAt: Date | null = null;
  if (input.trialEndsAt) {
    const parsed = input.trialEndsAt instanceof Date ? input.trialEndsAt : new Date(input.trialEndsAt);
    if (!Number.isNaN(parsed.getTime())) trialEndsAt = parsed;
  }
  if (!trialEndsAt) trialEndsAt = addDays(now, DEFAULT_STORE_FREE_TRIAL_DAYS);

  return {
    isFreeTrial: true,
    trialEndsAt,
    source: "google_client",
  };
}

export function storeTrialPaymentMeta(trial: StoreFreeTrialInfo): Record<string, unknown> {
  if (!trial.isFreeTrial) return { isFreeTrial: false };
  return {
    isFreeTrial: true,
    fundingSource: "trial",
    trialEndsAt: trial.trialEndsAt?.toISOString() ?? null,
    offerType: trial.offerType ?? null,
    offerDiscountType: trial.offerDiscountType ?? null,
    trialDetectionSource: trial.source,
  };
}
