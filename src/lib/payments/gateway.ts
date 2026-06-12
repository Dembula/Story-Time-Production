import {
  getPaymentGatewayMode,
  isDemoPaymentsMode,
  isPayFastConfigured,
} from "@/lib/payments/config";
import { createDemoGateway } from "@/lib/payments/providers/demo";
import { createUnconfiguredGateway } from "@/lib/payments/providers/unconfigured";

export type GatewayCheckoutRequest = {
  amount: number;
  currency: string;
  reference: string;
  returnUrl: string;
  customer: { email?: string | null; name?: string | null };
  metadata?: Record<string, unknown>;
};

export type GatewayCheckoutResponse = {
  provider: string;
  checkoutUrl: string;
  externalRef: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
};

export type GatewayCardConsentRequest = {
  reference: string;
  returnUrl: string;
  customer: { email?: string | null; name?: string | null; payerId?: string | null };
  initialAmount?: number;
};

export type GatewayPayoutRequest = {
  amount: number;
  currency: string;
  reference: string;
  beneficiaryToken: string;
  metadata?: Record<string, unknown>;
};

export interface PaymentGatewayAdapter {
  createCheckoutSession(payload: GatewayCheckoutRequest): Promise<GatewayCheckoutResponse>;
  createCardConsentSession(payload: GatewayCardConsentRequest): Promise<GatewayCheckoutResponse>;
  chargeSavedCard(payload: {
    consentReference: string;
    amount: number;
    currency: string;
    reference: string;
  }): Promise<{ provider: string; externalRef: string; status: "PENDING" | "COMPLETED" | "FAILED" }>;
  requestPayout(payload: GatewayPayoutRequest): Promise<{ provider: string; externalRef: string; status: string }>;
  verifyWebhookSignature(rawBody: string, getHeader: (name: string) => string | null): boolean;
}

export function getPaymentGateway(): PaymentGatewayAdapter {
  if (isPayFastConfigured()) {
    // Live PayFast adapter ships when merchant credentials are configured.
    return createUnconfiguredGateway();
  }
  if (isDemoPaymentsMode()) {
    return createDemoGateway();
  }
  return createUnconfiguredGateway();
}

export { getPaymentGatewayMode, isDemoPaymentsMode, isPayFastConfigured };
