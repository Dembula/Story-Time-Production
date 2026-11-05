import "server-only";

import { getGooglePlayAccessToken } from "@/lib/payments/google-play/auth";
import {
  allowUnverifiedGooglePlayPurchases,
  isGooglePlayVerificationConfigured,
} from "@/lib/payments/google-play/config";

export type GoogleVerifiedSubscription = {
  kind: "subscription";
  packageName: string;
  purchaseToken: string;
  productId: string | null;
  orderId: string | null;
  expiryTime: Date | null;
  startTime: Date | null;
  acknowledgementState: string | null;
  subscriptionState: string | null;
  testPurchase: boolean;
  raw: Record<string, unknown>;
};

export type GoogleVerifiedProduct = {
  kind: "product";
  packageName: string;
  purchaseToken: string;
  productId: string;
  orderId: string | null;
  purchaseState: number | null;
  consumptionState: number | null;
  acknowledgementState: number | null;
  purchaseTime: Date | null;
  testPurchase: boolean;
  raw: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseMillis(value: unknown): Date | null {
  if (typeof value === "string" && value.trim()) {
    const asNum = Number(value);
    if (Number.isFinite(asNum) && asNum > 0) return new Date(asNum);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(value);
  }
  return null;
}

async function googleGet(path: string): Promise<Record<string, unknown>> {
  const token = await getGooglePlayAccessToken();
  const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = asRecord(json.error);
    const message =
      (typeof err.message === "string" && err.message) ||
      `Google Play API ${res.status} for ${path}`;
    throw Object.assign(new Error(message), { status: res.status >= 400 ? res.status : 502, google: json });
  }
  return json;
}

/** Verify a Play Billing subscription purchase token (Subscriptionsv2). */
export async function verifyGooglePlaySubscription(options: {
  packageName: string;
  purchaseToken: string;
  expectedProductId?: string | null;
}): Promise<GoogleVerifiedSubscription> {
  const packageName = options.packageName.trim();
  const purchaseToken = options.purchaseToken.trim();
  if (!packageName || !purchaseToken) {
    throw Object.assign(new Error("packageName and purchaseToken are required"), { status: 400 });
  }

  const raw = await googleGet(
    `applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
  );

  const lineItems = Array.isArray(raw.lineItems) ? raw.lineItems : [];
  const first = asRecord(lineItems[0]);
  const productId =
    (typeof first.productId === "string" && first.productId) ||
    (typeof raw.productId === "string" && raw.productId) ||
    null;
  const expiryTime =
    parseMillis(first.expiryTime) ||
    parseMillis(raw.expiryTime) ||
    parseMillis(raw.expiryTimeMillis);
  const startTime = parseMillis(raw.startTime) || parseMillis(raw.startTimeMillis);
  const subscriptionState =
    (typeof raw.subscriptionState === "string" && raw.subscriptionState) || null;
  const acknowledgementState =
    (typeof raw.acknowledgementState === "string" && raw.acknowledgementState) || null;
  const orderId =
    (typeof raw.latestOrderId === "string" && raw.latestOrderId) ||
    (typeof raw.orderId === "string" && raw.orderId) ||
    null;
  const testPurchase = Boolean(raw.testPurchase) || Boolean(asRecord(raw.testPurchase).fopType);

  if (
    options.expectedProductId &&
    productId &&
    productId !== options.expectedProductId.trim()
  ) {
    throw Object.assign(
      new Error(`Google product mismatch: expected ${options.expectedProductId}, got ${productId}`),
      { status: 409 },
    );
  }

  const state = (subscriptionState || "").toUpperCase();
  if (
    state &&
    !state.includes("ACTIVE") &&
    !state.includes("IN_GRACE") &&
    !state.includes("ON_HOLD") &&
    !state.includes("PAUSED")
  ) {
    // Still allow recently expired within a short window? Prefer reject canceled/expired.
    if (state.includes("EXPIRED") || state.includes("REVOKED") || state.includes("PENDING")) {
      throw Object.assign(new Error(`Google subscription not active (${subscriptionState})`), {
        status: 409,
      });
    }
  }

  return {
    kind: "subscription",
    packageName,
    purchaseToken,
    productId,
    orderId,
    expiryTime,
    startTime,
    acknowledgementState,
    subscriptionState,
    testPurchase,
    raw,
  };
}

/** Verify a one-time in-app product (PPV / per-film). */
export async function verifyGooglePlayProduct(options: {
  packageName: string;
  productId: string;
  purchaseToken: string;
}): Promise<GoogleVerifiedProduct> {
  const packageName = options.packageName.trim();
  const productId = options.productId.trim();
  const purchaseToken = options.purchaseToken.trim();
  if (!packageName || !productId || !purchaseToken) {
    throw Object.assign(new Error("packageName, productId, and purchaseToken are required"), {
      status: 400,
    });
  }

  const raw = await googleGet(
    `applications/${encodeURIComponent(packageName)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`,
  );

  const purchaseState =
    typeof raw.purchaseState === "number"
      ? raw.purchaseState
      : typeof raw.purchaseState === "string"
        ? Number(raw.purchaseState)
        : null;
  // 0 = purchased, 1 = canceled, 2 = pending
  if (purchaseState != null && purchaseState !== 0) {
    throw Object.assign(new Error(`Google product not purchased (state ${purchaseState})`), {
      status: 409,
    });
  }

  return {
    kind: "product",
    packageName,
    purchaseToken,
    productId,
    orderId: typeof raw.orderId === "string" ? raw.orderId : null,
    purchaseState,
    consumptionState:
      typeof raw.consumptionState === "number"
        ? raw.consumptionState
        : typeof raw.consumptionState === "string"
          ? Number(raw.consumptionState)
          : null,
    acknowledgementState:
      typeof raw.acknowledgementState === "number"
        ? raw.acknowledgementState
        : typeof raw.acknowledgementState === "string"
          ? Number(raw.acknowledgementState)
          : null,
    purchaseTime: parseMillis(raw.purchaseTimeMillis),
    testPurchase: Boolean(raw.purchaseType === 0) || Boolean(raw.testPurchase),
    raw,
  };
}

/**
 * Require Play API verification when credentials exist.
 * Dev-only bypass via GOOGLE_PLAY_ALLOW_UNVERIFIED=true.
 */
export async function requireGooglePlaySubscriptionVerification(options: {
  packageName: string;
  purchaseToken: string;
  expectedProductId?: string | null;
}): Promise<GoogleVerifiedSubscription | null> {
  if (!isGooglePlayVerificationConfigured()) {
    if (allowUnverifiedGooglePlayPurchases()) return null;
    throw Object.assign(
      new Error(
        "Google Play verification is not configured. Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (or EMAIL + PRIVATE_KEY).",
      ),
      { status: 503 },
    );
  }
  return verifyGooglePlaySubscription(options);
}

export async function requireGooglePlayProductVerification(options: {
  packageName: string;
  productId: string;
  purchaseToken: string;
}): Promise<GoogleVerifiedProduct | null> {
  if (!isGooglePlayVerificationConfigured()) {
    if (allowUnverifiedGooglePlayPurchases()) return null;
    throw Object.assign(
      new Error(
        "Google Play verification is not configured. Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (or EMAIL + PRIVATE_KEY).",
      ),
      { status: 503 },
    );
  }
  return verifyGooglePlayProduct(options);
}

async function googlePost(path: string): Promise<void> {
  const token = await getGooglePlayAccessToken();
  const res = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok && res.status !== 400) {
    // 400 often means already acknowledged — ignore for idempotency.
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const err = asRecord(json.error);
    const message =
      (typeof err.message === "string" && err.message) ||
      `Google Play acknowledge failed (${res.status})`;
    console.warn("[google-play] acknowledge", message);
  }
}

/** Best-effort acknowledge so Play stops retrying the purchase. */
export async function acknowledgeGooglePlaySubscription(options: {
  packageName: string;
  purchaseToken: string;
}): Promise<void> {
  if (!isGooglePlayVerificationConfigured()) return;
  const packageName = options.packageName.trim();
  const purchaseToken = options.purchaseToken.trim();
  await googlePost(
    `applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(purchaseToken)}:acknowledge`,
  ).catch(() => {});
  // Subscriptionsv2 acknowledge path (preferred when available via orders — best effort).
  await googlePost(
    `applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
  ).catch(() => {});
}

export async function acknowledgeGooglePlayProduct(options: {
  packageName: string;
  productId: string;
  purchaseToken: string;
}): Promise<void> {
  if (!isGooglePlayVerificationConfigured()) return;
  await googlePost(
    `applications/${encodeURIComponent(options.packageName.trim())}/purchases/products/${encodeURIComponent(options.productId.trim())}/tokens/${encodeURIComponent(options.purchaseToken.trim())}:acknowledge`,
  ).catch(() => {});
}
