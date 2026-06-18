import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { calculatePlatformTransactionFee } from "@/lib/payments/fees";
import { STORYTIME_TRANSACTION_FEE_LABEL } from "@/lib/payments/config";
import { toGatewaySafeReference } from "@/lib/payments/reference";
import { PAYMENT_PROVIDER } from "@/lib/payments/config";
import { appendPaymentRecordToReturnUrl } from "@/lib/payments/return-url";
const db = prisma as any;

function generateInvoiceNumber(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

const PURPOSE_LABELS: Record<string, string> = {
  SCRIPT_REVIEW: "Story Time Executive Script Review",
  CASTING_ACQUISITION_FEE: "Casting acquisition fee",
  AUDITION_LISTING: "Audition listing fee",
};

function invoiceLineDescription(purpose: string, isMarketplace: boolean) {
  if (isMarketplace) return purpose.replace(/_/g, " ");
  return PURPOSE_LABELS[purpose] ?? purpose.replace(/_/g, " ");
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
  const marketplaceMeta = args.metadata ?? {};
  const isMarketplace = marketplaceMeta.marketplace === true;
  const baseAmount = typeof marketplaceMeta.baseAmount === "number" ? marketplaceMeta.baseAmount : args.amount;
  const marketplaceFee =
    typeof marketplaceMeta.feeAmount === "number" ? marketplaceMeta.feeAmount : 0;

  const invoiceLines = isMarketplace && marketplaceFee > 0
    ? [
        {
          description: invoiceLineDescription(args.purpose, isMarketplace),
          quantity: 1,
          unitAmount: baseAmount,
          totalAmount: baseAmount,
        },
        {
          description: STORYTIME_TRANSACTION_FEE_LABEL,
          quantity: 1,
          unitAmount: marketplaceFee,
          totalAmount: marketplaceFee,
        },
      ]
    : [
        {
          description: invoiceLineDescription(args.purpose, false),
          quantity: 1,
          unitAmount: args.amount,
          totalAmount: args.amount,
        },
      ];

  const invoice = await db.invoice.create({
    data: {
      userId: args.userId,
      invoiceNumber: generateInvoiceNumber("INV"),
      status: "PENDING",
      currency: "ZAR",
      subtotalAmount: isMarketplace ? baseAmount : args.amount,
      platformFeeAmount: isMarketplace ? marketplaceFee : platformFeeAmount,
      totalAmount: args.amount,
      metadata: {
        purpose: args.purpose,
        referenceType: args.referenceType,
        referenceId: args.referenceId,
        ...(args.metadata ?? {}),
      },
      lines: {
        create: invoiceLines,
      },
    },
  });

  const paymentRecord = await db.paymentRecord.create({
    data: {
      userId: args.userId,
      provider: PAYMENT_PROVIDER,
      purpose: args.purpose,
      status: "PENDING",
      amount: args.amount,
      currency: "ZAR",
      email: args.email ?? undefined,
      relatedEntityType: args.referenceType,
      relatedEntityId: args.referenceId,
      metadata: { invoiceId: invoice.id, returnUrl: args.returnUrl, ...(args.metadata ?? {}) },
    },
  });

  const gateway = getPaymentGateway();
  let checkout: Awaited<ReturnType<typeof gateway.createCheckoutSession>>;
  try {
    const checkoutPayload = {
      amount: args.amount,
      currency: "ZAR",
      reference: toGatewaySafeReference("pf", paymentRecord.id),
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

  await db.paymentRecord.update({
    where: { id: paymentRecord.id },
    data: { provider: checkout.provider },
  });

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
