import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import type {
  GatewayCardConsentRequest,
  GatewayCheckoutRequest,
  GatewayCheckoutResponse,
  GatewayPayoutRequest,
  PaymentGatewayAdapter,
} from "@/lib/payments/gateway";

const NOT_CONFIGURED =
  "Payment gateway is not configured yet. PayFast integration is required before checkout can start.";

function notConfigured(): never {
  throw new Error(NOT_CONFIGURED);
}

class UnconfiguredGatewayAdapter implements PaymentGatewayAdapter {
  async createCheckoutSession(_payload: GatewayCheckoutRequest): Promise<GatewayCheckoutResponse> {
    notConfigured();
  }

  async createCardConsentSession(_payload: GatewayCardConsentRequest): Promise<GatewayCheckoutResponse> {
    notConfigured();
  }

  async chargeSavedCard(_payload: {
    consentReference: string;
    amount: number;
    currency: string;
    reference: string;
  }): Promise<{ provider: string; externalRef: string; status: "PENDING" | "COMPLETED" | "FAILED" }> {
    notConfigured();
  }

  async requestPayout(_payload: GatewayPayoutRequest): Promise<{
    provider: string;
    externalRef: string;
    status: string;
  }> {
    notConfigured();
  }

  verifyWebhookSignature(_rawBody: string, _getHeader: (name: string) => string | null): boolean {
    return false;
  }
}

export function createUnconfiguredGateway(): PaymentGatewayAdapter {
  return new UnconfiguredGatewayAdapter();
}

export { PAYMENT_PROVIDER };
