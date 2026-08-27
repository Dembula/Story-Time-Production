import "server-only";

import { prisma } from "@/lib/prisma";
import {
  CREATOR_LICENSE_TYPE,
  CREATOR_PER_FILM_UPLOAD_PRICE,
  CREATOR_ONBOARDING_PLANS,
  formatCreatorLicenseSummary,
} from "@/lib/pricing";
import { ensureCreatorStudioProfilesForUser } from "@/lib/creator-studio";
import {
  CREATOR_DISTRIBUTION_LICENSE_APPLE_PURPOSE,
  CREATOR_FILM_UPLOAD_APPLE_PURPOSE,
} from "@/lib/creator-film-upload-payment";
import { resolveCreatorAppleProduct } from "@/lib/payments/apple-iap/products";
import {
  periodEndFromApplePayload,
  pickAppleJws,
  verifyAppleTransactionJws,
} from "@/lib/payments/apple-iap/jws";

const db = prisma as any;

export type CreatorApplePurchaseBody = {
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  signedTransaction?: string;
  signedTransactionInfo?: string;
  jwsRepresentation?: string;
  kind?: "creator_license" | "content_upload" | string;
  package?: string;
  billing?: string;
  contentId?: string | null;
  source?: string;
  environment?: string;
};

async function findApplePaymentByTransactionId(transactionId: string) {
  return db.paymentRecord.findFirst({
    where: {
      provider: "APPLE",
      OR: [
        { gatewayTransactionId: transactionId },
        { providerPaymentId: transactionId },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

function resolveVerified(body: CreatorApplePurchaseBody) {
  const jws = pickAppleJws(body as Record<string, unknown>);
  if (!jws) {
    throw Object.assign(new Error("signedTransaction (JWS) is required"), { status: 400 });
  }
  try {
    return verifyAppleTransactionJws(jws);
  } catch (err) {
    throw Object.assign(
      new Error(err instanceof Error ? err.message : "Apple transaction verification failed"),
      { status: 400 },
    );
  }
}

async function writeAppleSucceededPayment(options: {
  userId: string;
  email?: string | null;
  amount: number;
  purpose: string;
  relatedEntityType: string;
  relatedEntityId: string;
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  environment: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await findApplePaymentByTransactionId(options.transactionId);
  if (existing?.status === "SUCCEEDED") {
    return { payment: existing, already: true as const };
  }
  const now = new Date();
  const data = {
    status: "SUCCEEDED",
    amount: options.amount,
    paidAt: now,
    providerPaymentId: options.transactionId,
    gatewayTransactionId: options.transactionId,
    providerItnStatus: "COMPLETE",
    providerPaymentMethod: "apple_iap",
    settlementSource: "apple_iap",
    settlementAmount: options.amount,
    relatedEntityType: options.relatedEntityType,
    relatedEntityId: options.relatedEntityId,
    purpose: options.purpose,
    metadata: {
      productId: options.productId,
      originalTransactionId: options.originalTransactionId,
      environment: options.environment,
      source: "ios_app",
      ...options.metadata,
    },
  };
  if (existing) {
    return {
      payment: await db.paymentRecord.update({ where: { id: existing.id }, data }),
      already: false as const,
    };
  }
  return {
    payment: await db.paymentRecord.create({
      data: {
        userId: options.userId,
        email: options.email ?? undefined,
        provider: "APPLE",
        currency: "ZAR",
        ...data,
      },
    }),
    already: false as const,
  };
}

export async function processCreatorApplePurchase(options: {
  userId: string;
  email?: string | null;
  body: CreatorApplePurchaseBody;
}) {
  const verified = resolveVerified(options.body);
  const productId = verified.payload.productId;
  const mapped = resolveCreatorAppleProduct(productId);
  if (!mapped) {
    throw Object.assign(new Error(`Unknown creator productId: ${productId}`), { status: 400 });
  }

  const transactionId = verified.payload.transactionId;
  const originalTransactionId = verified.payload.originalTransactionId || transactionId;

  const prior = await findApplePaymentByTransactionId(transactionId);
  if (prior?.status === "SUCCEEDED") {
    if (mapped.kind === "content_upload") {
      return {
        ok: true as const,
        alreadyApplied: true as const,
        contentId: options.body.contentId ?? prior.relatedEntityId,
        reviewStatus: "PENDING",
      };
    }
    const license = await db.creatorDistributionLicense.findUnique({ where: { userId: options.userId } });
    return {
      ok: true as const,
      alreadyApplied: true as const,
      packageComplete: true as const,
      planSummary: license ? formatCreatorLicenseSummary(license.type) : null,
      license,
    };
  }

  if (mapped.kind === "content_upload") {
    const contentId = options.body.contentId?.trim();
    if (!contentId) {
      throw Object.assign(new Error("contentId is required for content_upload"), { status: 400 });
    }
    const content = await db.content.findFirst({
      where: { id: contentId, creatorId: options.userId },
      select: { id: true, reviewStatus: true },
    });
    if (!content) {
      throw Object.assign(new Error("Content not found for this creator"), { status: 404 });
    }

    const now = new Date();
    const updated = await db.content.update({
      where: { id: content.id },
      data: {
        reviewStatus: "PENDING",
        submittedAt: content.reviewStatus === "PENDING" ? undefined : now,
      },
    });

    await writeAppleSucceededPayment({
      userId: options.userId,
      email: options.email,
      amount: CREATOR_PER_FILM_UPLOAD_PRICE,
      purpose: CREATOR_FILM_UPLOAD_APPLE_PURPOSE,
      relatedEntityType: "Content",
      relatedEntityId: content.id,
      transactionId,
      originalTransactionId,
      productId,
      environment: verified.environment,
      metadata: { kind: "content_upload" },
    });

    return {
      ok: true as const,
      alreadyApplied: false as const,
      contentId: updated.id,
      reviewStatus: updated.reviewStatus,
    };
  }

  // creator_license
  const licenseType = mapped.licenseType ?? CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY;
  const billingInterval = mapped.billing === "MONTHLY" ? "month" : "year";
  const now = new Date();
  const periodEnd = periodEndFromApplePayload(verified.payload, billingInterval, now);

  let amount: number = CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price;
  if (licenseType === CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY) {
    amount = CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price;
  } else if (licenseType === CREATOR_LICENSE_TYPE.PIPELINE_YEARLY) {
    amount = CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price;
  }

  await ensureCreatorStudioProfilesForUser(options.userId);

  const existing = await db.creatorDistributionLicense.findUnique({
    where: { userId: options.userId },
  });

  const license = existing
    ? await db.creatorDistributionLicense.update({
        where: { id: existing.id },
        data: {
          type: licenseType,
          status: "ACTIVE",
          yearlyExpiresAt: periodEnd,
          autoRenew: true,
          cancelAtPeriodEnd: false,
          lastPaymentStatus: "SUCCEEDED",
          lastPaymentAt: now,
          lastPaymentError: null,
          renewalAttemptCount: 0,
          pastDueSince: null,
          externalPaymentId: originalTransactionId,
        },
      })
    : await db.creatorDistributionLicense.create({
        data: {
          userId: options.userId,
          type: licenseType,
          status: "ACTIVE",
          yearlyExpiresAt: periodEnd,
          autoRenew: true,
          cancelAtPeriodEnd: false,
          lastPaymentStatus: "SUCCEEDED",
          lastPaymentAt: now,
          externalPaymentId: originalTransactionId,
        },
      });

  await writeAppleSucceededPayment({
    userId: options.userId,
    email: options.email,
    amount,
    purpose: CREATOR_DISTRIBUTION_LICENSE_APPLE_PURPOSE,
    relatedEntityType: "CreatorDistributionLicense",
    relatedEntityId: license.id,
    transactionId,
    originalTransactionId,
    productId,
    environment: verified.environment,
    metadata: {
      kind: "creator_license",
      package: mapped.package ?? null,
      licenseType,
    },
  });

  return {
    ok: true as const,
    alreadyApplied: false as const,
    packageComplete: true as const,
    planSummary: formatCreatorLicenseSummary(license.type),
    license,
  };
}
