import { DEMO_PAYMENT_PROVIDER } from "@/lib/payments/config";
import type {
  GatewayCardConsentRequest,
  GatewayCheckoutRequest,
  GatewayCheckoutResponse,
  GatewayPayoutRequest,
  PaymentGatewayAdapter,
} from "@/lib/payments/gateway";

function appBaseUrl(): string {
  return (process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

function buildDemoCheckoutUrl(params: Record<string, string>): string {
  const url = new URL("/payments/demo-checkout", appBaseUrl());
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

class DemoGatewayAdapter implements PaymentGatewayAdapter {
  async createCheckoutSession(payload: GatewayCheckoutRequest): Promise<GatewayCheckoutResponse> {
    const paymentRecordId = String(payload.metadata?.paymentRecordId ?? "");
    const purpose = String(payload.metadata?.purpose ?? payload.metadata?.referenceType ?? "payment");

    return {
      provider: DEMO_PAYMENT_PROVIDER,
      checkoutUrl: buildDemoCheckoutUrl({
        redirectUrl: payload.returnUrl,
        reference: payload.reference,
        pr: paymentRecordId,
        amount: String(payload.amount),
        currency: payload.currency,
        purpose,
        flow: "checkout",
      }),
      externalRef: payload.reference,
      status: "PENDING",
    };
  }

  async createCardConsentSession(payload: GatewayCardConsentRequest): Promise<GatewayCheckoutResponse> {
    return {
      provider: DEMO_PAYMENT_PROVIDER,
      checkoutUrl: buildDemoCheckoutUrl({
        redirectUrl: payload.returnUrl,
        reference: payload.reference,
        flow: "card_consent",
        amount: payload.initialAmount != null ? String(payload.initialAmount) : "0",
        currency: "ZAR",
        purpose: "Save payment method (demo)",
        payerId: payload.customer.payerId ?? "",
      }),
      externalRef: payload.reference,
      status: "PENDING",
    };
  }

  async chargeSavedCard(payload: {
    consentReference: string;
    amount: number;
    currency: string;
    reference: string;
  }): Promise<{ provider: string; externalRef: string; status: "PENDING" | "COMPLETED" | "FAILED" }> {
    return {
      provider: DEMO_PAYMENT_PROVIDER,
      externalRef: `demo-charge-${payload.reference}`,
      status: "COMPLETED",
    };
  }

  async requestPayout(payload: GatewayPayoutRequest): Promise<{
    provider: string;
    externalRef: string;
    status: string;
  }> {
    return {
      provider: DEMO_PAYMENT_PROVIDER,
      externalRef: `demo-payout-${payload.reference}`,
      status: "COMPLETED",
    };
  }

  verifyWebhookSignature(_rawBody: string, _getHeader: (name: string) => string | null): boolean {
    return true;
  }
}

export function createDemoGateway(): PaymentGatewayAdapter {
  return new DemoGatewayAdapter();
}
