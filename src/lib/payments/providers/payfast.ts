import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import type {
  GatewayCardConsentRequest,
  GatewayCheckoutRequest,
  GatewayCheckoutResponse,
  GatewayPayoutRequest,
  PaymentGatewayAdapter,
} from "@/lib/payments/gateway";
import {
  getPayFastMerchantId,
  getPayFastMerchantKey,
  getPayFastPassphraseOrNull,
  payfastCheckoutPageUrl,
  payfastNotifyUrl,
  PAYFAST_API_BASE,
} from "@/lib/payments/providers/payfast-config";
import {
  generatePayFastCheckoutSignature,
  generatePayFastSignature,
  omitEmptyPayFastFields,
  parsePayFastFormBody,
  verifyPayFastSignature,
} from "@/lib/payments/providers/payfast-signature";
import { isPayFastChargeToken } from "@/lib/payments/payfast-saved-card";

function formatPayFastAmount(amount: number): string {
  return amount.toFixed(2);
}

function splitCustomerName(name?: string | null): { first: string; last: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Story", last: "Time" };
  if (parts.length === 1) return { first: parts[0], last: "Customer" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function buildSignedFields(fields: Record<string, string>): Record<string, string> {
  const cleaned = omitEmptyPayFastFields(fields);
  return {
    ...cleaned,
    signature: generatePayFastCheckoutSignature(cleaned, getPayFastPassphraseOrNull()),
  };
}

class PayFastGatewayAdapter implements PaymentGatewayAdapter {
  async createCheckoutSession(payload: GatewayCheckoutRequest): Promise<GatewayCheckoutResponse> {
    const paymentRecordId = String(payload.metadata?.paymentRecordId ?? "");
    if (!paymentRecordId) {
      throw new Error("paymentRecordId is required for PayFast checkout.");
    }

    return {
      provider: PAYMENT_PROVIDER,
      checkoutUrl: payfastCheckoutPageUrl(paymentRecordId),
      externalRef: payload.reference,
      status: "PENDING",
    };
  }

  async createCardConsentSession(payload: GatewayCardConsentRequest): Promise<GatewayCheckoutResponse> {
    return {
      provider: PAYMENT_PROVIDER,
      checkoutUrl: payfastCheckoutPageUrl(`consent:${payload.reference}`),
      externalRef: payload.reference,
      status: "PENDING",
    };
  }

  async chargeSavedCard(payload: {
    consentReference: string;
    amount: number;
    currency: string;
    reference: string;
    paymentRecordId?: string;
  }): Promise<{ provider: string; externalRef: string; status: "PENDING" | "COMPLETED" | "FAILED" }> {
    const token = payload.consentReference;
    if (!token || !isPayFastChargeToken(token)) {
      throw new Error("No saved PayFast token available for this account.");
    }

    const amountCents = String(Math.round(payload.amount * 100));
    const timestamp = new Date().toISOString();
    const signature = generatePayFastSignature(
      {
        "merchant-id": getPayFastMerchantId(),
        version: "v1",
        timestamp,
        amount: amountCents,
      },
      getPayFastPassphraseOrNull(),
    );

    const res = await fetch(`${PAYFAST_API_BASE}/subscriptions/${encodeURIComponent(token)}/adhoc`, {
      method: "POST",
      headers: {
        "merchant-id": getPayFastMerchantId(),
        version: "v1",
        timestamp,
        signature,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: amountCents,
        item_name: `Story Time renewal ${payload.reference}`,
        ...(payload.paymentRecordId
          ? {
              m_payment_id: payload.paymentRecordId,
              custom_str1: payload.paymentRecordId,
            }
          : {}),
      }).toString(),
    });

    const data = (await res.json().catch(() => null)) as { status?: string; pf_payment_id?: string } | null;
    if (!res.ok) {
      return { provider: PAYMENT_PROVIDER, externalRef: payload.reference, status: "FAILED" };
    }

    return {
      provider: PAYMENT_PROVIDER,
      externalRef: data?.pf_payment_id ?? payload.reference,
      status: data?.status === "success" ? "COMPLETED" : "PENDING",
    };
  }

  async requestPayout(payload: GatewayPayoutRequest): Promise<{
    provider: string;
    externalRef: string;
    status: string;
  }> {
    return {
      provider: PAYMENT_PROVIDER,
      externalRef: `manual-payout-${payload.reference}`,
      status: "PENDING_MANUAL",
    };
  }

  verifyWebhookSignature(rawBody: string, _getHeader: (name: string) => string | null): boolean {
    const data = parsePayFastFormBody(rawBody);
    return verifyPayFastSignature(data, data.signature, getPayFastPassphraseOrNull());
  }
}

/** Build signed PayFast form fields for a one-time checkout payment record. */
export function buildPayFastCheckoutFields(args: {
  paymentRecordId: string;
  amount: number;
  purpose: string;
  reference: string;
  returnUrl: string;
  customerEmail?: string | null;
  customerName?: string | null;
  metadata?: Record<string, unknown>;
}): Record<string, string> {
  const { first, last } = splitCustomerName(args.customerName);
  const cancelUrl = args.returnUrl.includes("?")
    ? `${args.returnUrl}&payment_status=cancelled`
    : `${args.returnUrl}?payment_status=cancelled`;

  const itemName = args.purpose.replace(/_/g, " ").slice(0, 100);
  const baseAmount = args.metadata?.baseAmount;
  const feeAmount = args.metadata?.feeAmount;

  const fields: Record<string, string> = {
    merchant_id: getPayFastMerchantId(),
    merchant_key: getPayFastMerchantKey(),
    return_url: args.returnUrl,
    cancel_url: cancelUrl,
    notify_url: payfastNotifyUrl(),
    name_first: first,
    name_last: last,
    email_address: args.customerEmail?.trim() || "no-reply@story-time.online",
    m_payment_id: args.reference,
    amount: formatPayFastAmount(args.amount),
    item_name: itemName,
    custom_str1: args.paymentRecordId,
  };

  if (typeof baseAmount === "number" && typeof feeAmount === "number" && feeAmount > 0) {
    fields.item_description = `Service R${Number(baseAmount).toFixed(2)} + Story Time transaction fee R${Number(feeAmount).toFixed(2)}`;
  }

  const referenceType = String(args.metadata?.referenceType ?? "").trim();
  const referenceId = String(args.metadata?.referenceId ?? "").trim();
  if (referenceType) fields.custom_str2 = referenceType;
  if (referenceId) fields.custom_str3 = referenceId;

  return buildSignedFields(fields);
}

export function buildPayFastCardConsentFields(args: {
  reference: string;
  returnUrl: string;
  customerEmail?: string | null;
  customerName?: string | null;
  payerId?: string | null;
}): Record<string, string> {
  const { first, last } = splitCustomerName(args.customerName);
  const cancelUrl = args.returnUrl.includes("?")
    ? `${args.returnUrl}&payment_status=cancelled`
    : `${args.returnUrl}?payment_status=cancelled`;

  const fields: Record<string, string> = {
    merchant_id: getPayFastMerchantId(),
    merchant_key: getPayFastMerchantKey(),
    return_url: args.returnUrl,
    cancel_url: cancelUrl,
    notify_url: payfastNotifyUrl(),
    name_first: first,
    name_last: last,
    email_address: args.customerEmail?.trim() || "no-reply@story-time.online",
    m_payment_id: args.reference,
    amount: "0.00",
    item_name: "Story Time card authorization",
    subscription_type: "2",
    custom_str2: "card_consent",
    custom_str3: args.reference,
  };

  const payerId = args.payerId?.trim();
  if (payerId) fields.custom_str1 = payerId;

  return buildSignedFields(fields);
}

export function createPayFastGateway(): PaymentGatewayAdapter {
  return new PayFastGatewayAdapter();
}
