/**
 * Payment gateway abstraction.
 * - Mock implementation: DB-backed TestPayment for testable flows.
 * - Live stub: throws or returns placeholder until real API (Stripe/PayStack) is configured.
 * All amounts in ZAR (rands).
 */

import { prisma } from "./prisma";

const USE_MOCK = process.env.PAYMENT_GATEWAY !== "live";

export type PaymentIntent = {
  id: string;
  amount: number;
  currency: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  metadata?: Record<string, string>;
};

export interface PaymentGateway {
  createPaymentIntent(params: {
    amount: number;
    currency?: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentIntent>;
  confirmPayment(id: string): Promise<{ success: boolean; error?: string }>;
  refund(id: string): Promise<{ success: boolean; error?: string }>;
}

/** Mock: persist intent as TestPayment, then "confirm" by updating status */
const mockGateway: PaymentGateway = {
  async createPaymentIntent({ amount, currency = "ZAR", metadata }) {
    const test = await prisma.testPayment.create({
      data: {
        amount,
        currency,
        status: "PENDING",
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
    return {
      id: test.id,
      amount: test.amount,
      currency: test.currency,
      status: test.status as "PENDING" | "COMPLETED" | "FAILED",
      metadata: metadata,
    };
  },
  async confirmPayment(id: string) {
    const test = await prisma.testPayment.findUnique({ where: { id } });
    if (!test) return { success: false, error: "Payment not found" };
    if (test.status === "COMPLETED") return { success: true };
    if (process.env.PAYMENT_MOCK_FAIL === "true")
      return { success: false, error: "Mock failure" };
    await prisma.testPayment.update({
      where: { id },
      data: { status: "COMPLETED", updatedAt: new Date() },
    });
    return { success: true };
  },
  async refund(id: string) {
    const test = await prisma.testPayment.findUnique({ where: { id } });
    if (!test) return { success: false, error: "Payment not found" };
    await prisma.testPayment.update({
      where: { id },
      data: { status: "FAILED", updatedAt: new Date() },
    });
    return { success: true };
  },
};

/** Live stub: not configured yet */
const liveStub: PaymentGateway = {
  async createPaymentIntent() {
    throw new Error(
      "Live payment gateway not configured. Set PAYMENT_GATEWAY=live and configure API keys."
    );
  },
  async confirmPayment() {
    return { success: false, error: "Live gateway not configured" };
  },
  async refund() {
    return { success: false, error: "Live gateway not configured" };
  },
};

export const paymentGateway: PaymentGateway = USE_MOCK ? mockGateway : liveStub;

/** Helper: create and immediately confirm (for simple flows in test mode) */
export async function createAndConfirmPayment(params: {
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
}): Promise<{ id: string; success: boolean; error?: string }> {
  const intent = await paymentGateway.createPaymentIntent(params);
  const result = await paymentGateway.confirmPayment(intent.id);
  return {
    id: intent.id,
    success: result.success,
    error: result.error,
  };
}
