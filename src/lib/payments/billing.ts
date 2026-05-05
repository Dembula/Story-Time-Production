import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { calculatePlatformTransactionFee } from "@/lib/payments/fees";
import { toGatewaySafeReference } from "@/lib/payments/reference";
import { appendPaymentRecordToReturnUrl } from "@/lib/payments/return-url";
const db = prisma as any;

function generateInvoiceNumber(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export async function initializeCheckout(args: {
  userId: string;
  email?: string | null;
  customerName?: string | null;
  amount: number;
  purpose: string;
  referenceType: string;
  referenceId: string;
  returnUrl: string;
  metadata?: Record<string, unknown>;
}) {
  const platformFeeAmount = calculatePlatformTransactionFee(args.amount);
  const invoice = await db.invoice.create({
    data: {
      userId: args.userId,
      invoiceNumber: generateInvoiceNumber("INV"),
      status: "PENDING",
      currency: "ZAR",
      subtotalAmount: args.amount,
      platformFeeAmount,
      totalAmount: args.amount,
      metadata: {
        purpose: args.purpose,
        referenceType: args.referenceType,
        referenceId: args.referenceId,
        ...(args.metadata ?? {}),
      },
      lines: {
        create: [
          {
            description: args.purpose,
            quantity: 1,
            unitAmount: args.amount,
            totalAmount: args.amount,
          },
        ],
      },
    },
  });

  const paymentRecord = await db.paymentRecord.create({
    data: {
      userId: args.userId,
      provider: "STITCH",
      purpose: args.purpose,
      status: "PENDING",
      amount: args.amount,
      currency: "ZAR",
      email: args.email ?? undefined,
      relatedEntityType: args.referenceType,
      relatedEntityId: args.referenceId,
      metadata: { invoiceId: invoice.id, ...(args.metadata ?? {}) },
    },
  });

  const gateway = getPaymentGateway();
  let checkout: Awaited<ReturnType<typeof gateway.createCheckoutSession>>;
  try {
    const checkoutPayload = {
      amount: args.amount,
      currency: "ZAR",
      reference: toGatewaySafeReference("st", paymentRecord.id),
      returnUrl: appendPaymentRecordToReturnUrl(args.returnUrl, paymentRecord.id),
      customer: { email: args.email ?? null, name: args.customerName ?? null },
      metadata: {
        paymentRecordId: paymentRecord.id,
        invoiceId: invoice.id,
        referenceType: args.referenceType,
        referenceId: args.referenceId,
      },
    };
    try {
      checkout = await gateway.createCheckoutSession(checkoutPayload);
    } catch (firstError) {
      // One immediate retry to absorb transient gateway/network failures.
      checkout = await gateway.createCheckoutSession(checkoutPayload).catch(() => {
        throw firstError;
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown payment gateway error.";
    await db.paymentRecord.update({
      where: { id: paymentRecord.id },
      data: {
        status: "FAILED",
        metadata: {
          ...(paymentRecord.metadata ?? {}),
          checkoutInitError: message,
        },
      },
    });
    throw new Error(`Unable to initialize checkout: ${message}`);
  }

  await db.gatewayReference.create({
    data: {
      provider: checkout.provider,
      referenceType: args.referenceType,
      referenceId: args.referenceId,
      externalRef: checkout.externalRef,
      invoiceId: invoice.id,
      metadata: { paymentRecordId: paymentRecord.id, purpose: args.purpose },
    },
  });

  return { invoice, paymentRecord, checkout };
}
