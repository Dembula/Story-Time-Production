import crypto from "node:crypto";
import {
  PaymentGatewayAdapter,
  GatewayCheckoutRequest,
  GatewayCheckoutResponse,
  GatewayPayoutRequest,
  GatewayCardConsentRequest,
} from "@/lib/payments/gateway";
import { STITCH_PROVIDER } from "@/lib/payments/config";

const STITCH_API_BASE = process.env.STITCH_API_BASE?.trim() || "https://express.stitch.money";
const STITCH_CLIENT_ID = process.env.STITCH_CLIENT_ID?.trim() || "";
const STITCH_CLIENT_SECRET = process.env.STITCH_CLIENT_SECRET?.trim() || "";
const STITCH_WEBHOOK_SECRET = process.env.STITCH_WEBHOOK_SECRET?.trim() || "";
const STITCH_REDIRECT_URL = process.env.STITCH_REDIRECT_URL?.trim() || "";
const STITCH_PAYOUTS_ENABLED = process.env.STITCH_PAYOUTS_ENABLED === "true";
const STITCH_TOKEN_PATH = process.env.STITCH_TOKEN_PATH?.trim() || "/api/v1/token";
const STITCH_CHECKOUT_PATH = process.env.STITCH_CHECKOUT_PATH?.trim() || "/api/v1/payment-links";
const STITCH_PAYOUT_PATH = process.env.STITCH_PAYOUT_PATH?.trim() || "/api/v1/withdrawal";
const STITCH_TOKEN_SCOPE = process.env.STITCH_TOKEN_SCOPE?.trim() || "client_paymentrequest";
const STITCH_CONSENT_SCOPE = process.env.STITCH_CONSENT_SCOPE?.trim() || "client_recurringpaymentconsentrequest";
const STITCH_CARD_CONSENT_PATH = process.env.STITCH_CARD_CONSENT_PATH?.trim() || "/api/v1/card-consents";
const STITCH_CARD_CONSENT_CHARGE_PATH_TEMPLATE =
  process.env.STITCH_CARD_CONSENT_CHARGE_PATH_TEMPLATE?.trim() || "/api/v1/card-consents/{consentRequestId}/initiate-payment";
const STITCH_CARD_CONSENT_INITIAL_AMOUNT = Number(process.env.STITCH_CARD_CONSENT_INITIAL_AMOUNT || "0");
const APP_BASE_URL = process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
const STITCH_MOCK_MODE =
  process.env.STITCH_MOCK_MODE === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.STITCH_MOCK_MODE !== "false");
const cachedAccessTokenByScope = new Map<string, { token: string; expiresAtMs: number }>();
type StitchHttpMethod = "GET" | "POST" | "DELETE";

type StitchRequestOptions = {
  method?: StitchHttpMethod;
  body?: Record<string, unknown>;
  scope?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
};

function parseJsonSafe(payload: string): Record<string, unknown> | null {
  if (!payload.trim()) return null;
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchStitchToken(scope = STITCH_TOKEN_SCOPE): Promise<string> {
  if (!STITCH_CLIENT_ID || !STITCH_CLIENT_SECRET) {
    throw new Error("Stitch credentials are missing. Set STITCH_CLIENT_ID and STITCH_CLIENT_SECRET.");
  }
  const cached = cachedAccessTokenByScope.get(scope);
  if (cached && Date.now() < cached.expiresAtMs) {
    return cached.token;
  }
  const res = await fetch(`${STITCH_API_BASE}${STITCH_TOKEN_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId: STITCH_CLIENT_ID,
      clientSecret: STITCH_CLIENT_SECRET,
      scope,
    }),
  });
  const raw = await res.text().catch(() => "");
  const json = parseJsonSafe(raw) ?? {};
  if (!res.ok) {
    const apiError =
      (json.error as string | undefined) ||
      (json.message as string | undefined) ||
      (raw ? raw.slice(0, 220) : undefined);
    throw new Error(apiError || `Stitch token request failed (${STITCH_TOKEN_PATH}): ${res.status}`);
  }
  const token =
    getString(json.accessToken) ||
    getString((json.data as Record<string, unknown> | undefined)?.accessToken) ||
    getString(json.token);
  if (!token) {
    throw new Error("Stitch token response missing access token.");
  }
  cachedAccessTokenByScope.set(scope, { token, expiresAtMs: Date.now() + 14 * 60 * 1000 });
  return token;
}

function buildStitchUrl(path: string, query?: StitchRequestOptions["query"]) {
  const url = new URL(`${STITCH_API_BASE}${path}`);
  if (!query) return url.toString();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function parseStitchError(json: Record<string, unknown>, raw: string, status: number) {
  const message =
    (json.error as string | undefined) ||
    (json.message as string | undefined) ||
    (Array.isArray(json.generalErrors) ? (json.generalErrors[0] as string | undefined) : undefined) ||
    (raw ? raw.slice(0, 300) : undefined);
  return message || `Stitch request failed: ${status}`;
}

async function fetchStitch(path: string, options: StitchRequestOptions = {}) {
  const method = options.method ?? "POST";
  const scope = options.scope ?? STITCH_TOKEN_SCOPE;
  const token = await fetchStitchToken(scope);
  const res = await fetch(buildStitchUrl(path, options.query), {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
  });
  const raw = await res.text().catch(() => "");
  const json = parseJsonSafe(raw) ?? {};
  if (!res.ok) {
    throw new Error(parseStitchError(json, raw, res.status));
  }
  return json;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveCheckoutUrl(response: Record<string, unknown>): string | null {
  const payment = (response.data as Record<string, unknown> | undefined)?.payment as
    | Record<string, unknown>
    | undefined;
  const direct =
    getString(payment?.link) ||
    getString(payment?.url) ||
    getString(response.checkoutUrl) ||
    getString(response.paymentUrl) ||
    getString(response.url) ||
    getString(response.redirectUrl);
  if (direct) return direct;
  const data = response.data as Record<string, unknown> | undefined;
  if (!data) return null;
  return (
    getString(data.checkoutUrl) ||
    getString(data.paymentUrl) ||
    getString(data.url) ||
    getString(data.redirectUrl)
  );
}

function buildMockCheckoutUrl(redirectUrl: string, reference: string): string {
  const base = new URL("/payments/mock-checkout", APP_BASE_URL);
  base.searchParams.set("redirectUrl", redirectUrl);
  base.searchParams.set("reference", reference);
  base.searchParams.set("provider", STITCH_PROVIDER.toLowerCase());
  try {
    const target = new URL(redirectUrl);
    base.searchParams.set("returnHost", target.host);
    return base.toString();
  } catch {
    return base.toString();
  }
}

function appendRedirectUrl(rawCheckoutUrl: string, redirectUrl: string): string {
  try {
    const url = new URL(rawCheckoutUrl);
    url.searchParams.set("redirect_url", redirectUrl);
    return url.toString();
  } catch {
    const separator = rawCheckoutUrl.includes("?") ? "&" : "?";
    return `${rawCheckoutUrl}${separator}redirect_url=${encodeURIComponent(redirectUrl)}`;
  }
}

function isUnsafeInternalCheckoutUrl(rawUrl: string): boolean {
  try {
    const app = new URL(APP_BASE_URL);
    const candidate = new URL(rawUrl, APP_BASE_URL);
    if (candidate.origin !== app.origin) return false;
    return !candidate.pathname.startsWith("/payments/mock-checkout");
  } catch {
    return false;
  }
}

class StitchGatewayAdapter implements PaymentGatewayAdapter {
  async createCheckoutSession(payload: GatewayCheckoutRequest): Promise<GatewayCheckoutResponse> {
    const redirectUrl = payload.returnUrl || STITCH_REDIRECT_URL;
    if (!redirectUrl) {
      throw new Error("Missing Stitch redirect URL.");
    }
    let response: Record<string, unknown>;
    try {
      response = await fetchStitch(STITCH_CHECKOUT_PATH, {
        body: {
          amount: Math.round(payload.amount * 100),
          merchantReference: payload.reference,
          payerName: payload.customer?.name ?? undefined,
          payerEmailAddress: payload.customer?.email ?? undefined,
        },
      });
    } catch (error) {
      if (!STITCH_MOCK_MODE) {
        throw error;
      }
      return {
        provider: STITCH_PROVIDER,
        checkoutUrl: buildMockCheckoutUrl(redirectUrl, payload.reference),
        externalRef: payload.reference,
        status: "PENDING",
      };
    }
    const gatewayCheckoutUrl = resolveCheckoutUrl(response);
    if (!gatewayCheckoutUrl) {
      if (!STITCH_MOCK_MODE) {
        throw new Error("Stitch checkout response missing checkout URL.");
      }
      return {
        provider: STITCH_PROVIDER,
        checkoutUrl: buildMockCheckoutUrl(redirectUrl, payload.reference),
        externalRef: payload.reference,
        status: "PENDING",
      };
    }
    if (isUnsafeInternalCheckoutUrl(gatewayCheckoutUrl)) {
      if (!STITCH_MOCK_MODE) {
        throw new Error("Rejected invalid checkout URL returned by provider.");
      }
      return {
        provider: STITCH_PROVIDER,
        checkoutUrl: buildMockCheckoutUrl(redirectUrl, payload.reference),
        externalRef: payload.reference,
        status: "PENDING",
      };
    }
    return {
      provider: STITCH_PROVIDER,
      checkoutUrl: appendRedirectUrl(gatewayCheckoutUrl, redirectUrl),
      // Persist our own reference so webhook correlation stays deterministic.
      externalRef: payload.reference,
      status: "PENDING",
    };
  }

  async createCardConsentSession(payload: GatewayCardConsentRequest): Promise<GatewayCheckoutResponse> {
    const redirectUrl = payload.returnUrl || STITCH_REDIRECT_URL;
    if (!redirectUrl) {
      throw new Error("Missing Stitch redirect URL.");
    }

    let response: Record<string, unknown>;
    try {
      response = await fetchStitch(
        STITCH_CARD_CONSENT_PATH,
        {
          body: {
            payerFullName: payload.customer?.name ?? undefined,
            email: payload.customer?.email ?? undefined,
            payerId: payload.customer?.payerId ?? payload.reference,
            initialAmount: Math.max(0, Math.round((payload.initialAmount ?? STITCH_CARD_CONSENT_INITIAL_AMOUNT) * 100)),
          },
          scope: STITCH_CONSENT_SCOPE,
        },
      );
    } catch (error) {
      if (!STITCH_MOCK_MODE) throw error;
      return {
        provider: STITCH_PROVIDER,
        checkoutUrl: buildMockCheckoutUrl(redirectUrl, payload.reference),
        externalRef: payload.reference,
        status: "PENDING",
      };
    }

    const consentData = (response.data as Record<string, unknown> | undefined) ?? {};
    const checkoutUrl = getString(consentData.url) || getString(response.url);
    const consentId = getString(consentData.id) || payload.reference;
    if (!checkoutUrl) {
      throw new Error("Card consent response missing consent URL.");
    }
    return {
      provider: STITCH_PROVIDER,
      checkoutUrl: appendRedirectUrl(checkoutUrl, redirectUrl),
      externalRef: consentId,
      status: "PENDING",
    };
  }

  async chargeSavedCard(payload: {
    consentReference: string;
    amount: number;
    currency: string;
    reference: string;
  }): Promise<{ provider: string; externalRef: string; status: "PENDING" | "COMPLETED" | "FAILED" }> {
    const path = STITCH_CARD_CONSENT_CHARGE_PATH_TEMPLATE.replace("{consentRequestId}", payload.consentReference);
    const response = await fetchStitch(
      path,
      { body: { amount: Math.round(payload.amount * 100) }, scope: STITCH_CONSENT_SCOPE },
    );
    const payment = (response.data as Record<string, unknown> | undefined)?.payment as Record<string, unknown> | undefined;
    const statusRaw = String(payment?.status || "").toUpperCase();
    const status: "PENDING" | "COMPLETED" | "FAILED" =
      statusRaw === "PAID" || statusRaw === "SUCCESS" ? "COMPLETED" : statusRaw === "FAILED" ? "FAILED" : "PENDING";
    return {
      provider: STITCH_PROVIDER,
      externalRef: getString(payment?.id) || payload.reference,
      status,
    };
  }

  async requestPayout(payload: GatewayPayoutRequest): Promise<{ provider: string; externalRef: string; status: string }> {
    if (!STITCH_PAYOUTS_ENABLED) {
      return {
        provider: STITCH_PROVIDER,
        externalRef: `stub_${payload.reference}`,
        status: "PROCESSING",
      };
    }
    const response = await fetchStitch(STITCH_PAYOUT_PATH, {
      body: {
        amount: Math.round(payload.amount * 100),
        withdrawalType: "INSTANT",
      },
    });
    return {
      provider: STITCH_PROVIDER,
      externalRef: (response.id as string) || payload.reference,
      status: "PROCESSING",
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    if (STITCH_MOCK_MODE && !STITCH_WEBHOOK_SECRET) return true;
    if (!STITCH_WEBHOOK_SECRET) return false;
    if (!signature) return false;
    const digest = crypto.createHmac("sha256", STITCH_WEBHOOK_SECRET).update(rawBody).digest("hex");
    const provided = signature.replace(/^sha256=/i, "").trim();
    if (digest.length !== provided.length) return false;
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(provided, "utf8"));
  }

  async getAccountBalance() {
    return fetchStitch("/api/v1/account/balance", { method: "GET" });
  }

  async getAccountBankDetails() {
    return fetchStitch("/api/v1/account/bank-details", { method: "GET" });
  }

  async createWebhook(url: string) {
    return fetchStitch("/api/v1/webhook", { body: { url } });
  }

  async createRedirectUrl(redirectUrl: string) {
    return fetchStitch("/api/v1/redirect-urls", { body: { redirectUrl } });
  }

  async listRedirectUrls() {
    return fetchStitch("/api/v1/redirect-urls", { method: "GET" });
  }

  async deleteRedirectUrl(redirectUrl: string) {
    return fetchStitch("/api/v1/redirect-urls", {
      method: "DELETE",
      body: { redirectUrl },
    });
  }

  async getFees() {
    return fetchStitch("/api/v1/fees", { method: "GET" });
  }

  async createPaymentLink(payload: {
    amount: number;
    merchantReference: string;
    expiresAt?: string;
    payerName?: string;
    payerEmailAddress?: string;
    payerPhoneNumber?: string;
    collectDeliveryDetails?: boolean;
    skipCheckoutPage?: boolean;
    deliveryFee?: number;
  }) {
    return fetchStitch("/api/v1/payment-links", {
      body: {
        ...payload,
        amount: Math.round(payload.amount),
      },
    });
  }

  async getPaymentLink(paymentLinkId: string) {
    return fetchStitch(`/api/v1/payment-links/${paymentLinkId}`, { method: "GET" });
  }

  async listPaymentLinks(query?: {
    startTime?: string;
    endTime?: string;
    status?: string;
    limit?: number;
    merchantReference?: string;
    payerName?: string;
  }) {
    return fetchStitch("/api/v1/payment-links", {
      method: "GET",
      query,
    });
  }

  async addDeliveryDetail(paymentLinkId: string, deliveryFee: number) {
    return fetchStitch(`/api/v1/payment-links/${paymentLinkId}/delivery-detail`, {
      body: { deliveryFee: Math.round(deliveryFee) },
    });
  }

  async getDeliveryDetail(paymentLinkId: string) {
    return fetchStitch(`/api/v1/payment-links/${paymentLinkId}/delivery-detail`, { method: "GET" });
  }

  async getPayment(paymentId: string) {
    return fetchStitch(`/api/v1/payment/${paymentId}`, { method: "GET" });
  }

  async listPayments() {
    return fetchStitch("/api/v1/payment", { method: "GET" });
  }

  async getRefund(refundId: string) {
    return fetchStitch(`/api/v1/refunds/${refundId}`, { method: "GET" });
  }

  async listRefunds() {
    return fetchStitch("/api/v1/refunds", { method: "GET" });
  }

  async createPaymentRefund(paymentId: string, payload: { amount: number; reason: string }) {
    return fetchStitch(`/api/v1/payment/${paymentId}/refund`, {
      body: {
        amount: Math.round(payload.amount),
        reason: payload.reason,
      },
    });
  }

  async listPaymentRefunds(paymentId: string) {
    return fetchStitch(`/api/v1/payment/${paymentId}/refund`, { method: "GET" });
  }

  async createSubscription(payload: {
    amount: number;
    merchantReference: string;
    endDate?: string;
    startDate?: string;
    payerFullName: string;
    email: string;
    payerId: string;
    recurrence: {
      frequency: string;
      interval: number;
      byMonth?: number;
      byMonthDay?: number;
    };
    initialAmount?: number;
  }) {
    return fetchStitch("/api/v1/subscriptions", { body: payload, scope: STITCH_CONSENT_SCOPE });
  }

  async listSubscriptions() {
    return fetchStitch("/api/v1/subscriptions", { method: "GET", scope: STITCH_CONSENT_SCOPE });
  }

  async cancelSubscription(subscriptionId: string) {
    return fetchStitch(`/api/v1/subscriptions/${subscriptionId}/cancel`, { scope: STITCH_CONSENT_SCOPE });
  }

  async getCardConsent(consentRequestId: string) {
    return fetchStitch(`/api/v1/card-consents/${consentRequestId}`, { method: "GET", scope: STITCH_CONSENT_SCOPE });
  }

  async withdraw(amountInCents: number, withdrawalType: "INSTANT" | "STANDARD" = "INSTANT") {
    return fetchStitch("/api/v1/withdrawal", {
      body: { amount: Math.round(amountInCents), withdrawalType },
    });
  }

  async withdrawMax(withdrawalType: "INSTANT" | "STANDARD" = "INSTANT") {
    return fetchStitch("/api/v1/withdrawal/max", {
      body: { withdrawalType },
    });
  }

  async listTerminals() {
    return fetchStitch("/api/v1/terminals", { method: "GET" });
  }

  async createTerminalSession(payload: {
    terminalId: string;
    amount: number;
    idempotencyKey: string;
    correlationId?: string;
    source?: "SHOPIFY_POS" | "DIRECT";
  }) {
    return fetchStitch("/api/v1/terminal-sessions", {
      body: {
        terminalId: payload.terminalId,
        amount: Math.round(payload.amount),
        idempotencyKey: payload.idempotencyKey,
        correlationId: payload.correlationId,
      },
    });
  }

  async getTerminalSession(sessionId: string) {
    return fetchStitch(`/api/v1/terminal-sessions/${sessionId}`, { method: "GET" });
  }

  async cancelTerminalSession(sessionId: string) {
    return fetchStitch(`/api/v1/terminal-sessions/${sessionId}/cancel`);
  }

  async refundTerminalSession(sessionId: string, payload: { amount: number; reason: string }) {
    return fetchStitch(`/api/v1/terminal-sessions/${sessionId}/refunds`, {
      body: {
        amount: Math.round(payload.amount),
        reason: payload.reason,
      },
    });
  }
}

export function createStitchGateway(): PaymentGatewayAdapter {
  return new StitchGatewayAdapter();
}
