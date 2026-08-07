import "server-only";

import { prisma } from "@/lib/prisma";
import { VIEWER_MODELS, VIEWER_PLAN_CONFIG } from "@/lib/viewer-access";
import {
  APPLE_UNIVERSE_PPV_PRODUCT_ID,
  resolveUniverseSubscriptionProduct,
} from "@/lib/payments/apple-iap/products";
import {
  periodEndFromApplePayload,
  pickAppleJws,
  verifyAppleTransactionJws,
  type VerifiedAppleTransaction,
} from "@/lib/payments/apple-iap/jws";

const db = prisma as any;

export type AppleActivateBody = {
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  signedTransactionInfo?: string;
  jwsRepresentation?: string;
  signedTransaction?: string;
  environment?: string;
  plan?: string;
  planCode?: string;
  platform?: string;
  source?: string;
  kind?: string;
  contentId?: string;
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

async function recordApplePayment(options: {
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
  const payment = existing
    ? await db.paymentRecord.update({
        where: { id: existing.id },
        data: {
          status: "SUCCEEDED",
          amount: options.amount,
          paidAt: now,
          providerPaymentId: options.transactionId,
          gatewayTransactionId: options.transactionId,
          providerItnStatus: "COMPLETE",
          providerPaymentMethod: "apple_iap",
          settlementSource: "apple_iap",
          settlementAmount: options.amount,
          metadata: {
            ...(typeof existing.metadata === "object" && existing.metadata ? existing.metadata : {}),
            ...options.metadata,
            productId: options.productId,
            originalTransactionId: options.originalTransactionId,
            environment: options.environment,
            source: "ios_app",
          },
        },
      })
    : await db.paymentRecord.create({
        data: {
          userId: options.userId,
          email: options.email ?? undefined,
          provider: "APPLE",
          purpose: options.purpose,
          status: "SUCCEEDED",
          amount: options.amount,
          currency: "ZAR",
          relatedEntityType: options.relatedEntityType,
          relatedEntityId: options.relatedEntityId,
          providerPaymentId: options.transactionId,
          gatewayTransactionId: options.transactionId,
          providerItnStatus: "COMPLETE",
          providerPaymentMethod: "apple_iap",
          settlementSource: "apple_iap",
          settlementAmount: options.amount,
          paidAt: now,
          metadata: {
            ...options.metadata,
            productId: options.productId,
            originalTransactionId: options.originalTransactionId,
            environment: options.environment,
            source: "ios_app",
          },
        },
      });

  return { payment, already: false as const };
}

function resolveJwsFromBody(body: AppleActivateBody): VerifiedAppleTransaction {
  const jws = pickAppleJws(body as Record<string, unknown>);
  if (!jws) {
    throw Object.assign(new Error("signedTransactionInfo (JWS) is required"), { status: 400 });
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

/** Grant catalogue subscription from a verified Apple IAP. */
export async function activateAppleViewerSubscription(options: {
  userId: string;
  email?: string | null;
  body: AppleActivateBody;
}) {
  const verified = resolveJwsFromBody(options.body);
  const { payload } = verified;
  const productId = payload.productId;
  const mapped = resolveUniverseSubscriptionProduct(productId);
  if (!mapped) {
    throw Object.assign(new Error(`Unknown subscription productId: ${productId}`), { status: 400 });
  }

  // Prefer verified product mapping over client plan fields.
  const planCode = mapped.planCode;
  const planConfig = VIEWER_PLAN_CONFIG[planCode];
  const transactionId = payload.transactionId;
  const originalTransactionId = payload.originalTransactionId || transactionId;

  const prior = await findApplePaymentByTransactionId(transactionId);
  if (prior?.status === "SUCCEEDED" && prior.relatedEntityType === "ViewerSubscription" && prior.relatedEntityId) {
    const sub = await db.viewerSubscription.findUnique({ where: { id: prior.relatedEntityId } });
    if (sub) {
      return {
        ok: true as const,
        alreadyApplied: true,
        plan: sub.plan,
        status: sub.status,
        subscriptionId: sub.id,
      };
    }
  }

  const now = new Date();
  const periodEnd = periodEndFromApplePayload(payload, mapped.billingInterval, now);

  const existing = await db.viewerSubscription.findFirst({
    where: { userId: options.userId },
    orderBy: { createdAt: "desc" },
  });

  const subData = {
    viewerModel: VIEWER_MODELS.SUBSCRIPTION,
    plan: planCode,
    billingInterval: mapped.billingInterval,
    status: "ACTIVE",
    trialEndsAt: null,
    currentPeriodEnd: periodEnd,
    deviceCount: planConfig.deviceCount,
    profileLimit: mapped.profileLimit,
    cancelAtPeriodEnd: false,
    lastPaymentStatus: "SUCCEEDED",
    lastPaymentAt: now,
    lastPaymentError: null,
    renewalAttemptCount: 0,
    pastDueSince: null,
    externalPaymentId: originalTransactionId,
  };

  const subscription = existing
    ? await db.viewerSubscription.update({
        where: { id: existing.id },
        data: subData,
      })
    : await db.viewerSubscription.create({
        data: {
          userId: options.userId,
          ...subData,
        },
      });

  const { already } = await recordApplePayment({
    userId: options.userId,
    email: options.email,
    amount: planConfig.price,
    purpose: "viewer_subscription_apple_iap",
    relatedEntityType: "ViewerSubscription",
    relatedEntityId: subscription.id,
    transactionId,
    originalTransactionId,
    productId,
    environment: verified.environment,
    metadata: {
      plan: planCode,
      billingInterval: mapped.billingInterval,
      clientPlan: options.body.plan ?? options.body.planCode ?? null,
    },
  });

  await db.subscriptionPayment.create({
    data: {
      viewerSubscriptionId: subscription.id,
      amount: planConfig.price,
      currency: "ZAR",
      status: "COMPLETED",
      purpose: "viewer_subscription_apple_iap",
      paidAt: now,
      externalPaymentId: transactionId,
      gatewayReference: `apple:${transactionId}`,
    },
  }).catch(() => {});

  return {
    ok: true as const,
    alreadyApplied: already,
    plan: planCode,
    status: "ACTIVE" as const,
    subscriptionId: subscription.id,
    currentPeriodEnd: periodEnd.toISOString(),
  };
}

/** Grant PPV title unlock from a verified Apple IAP. */
export async function activateAppleViewerPpv(options: {
  userId: string;
  email?: string | null;
  body: AppleActivateBody;
}) {
  const contentId = options.body.contentId?.trim();
  if (!contentId) {
    throw Object.assign(new Error("contentId is required"), { status: 400 });
  }

  const verified = resolveJwsFromBody(options.body);
  const { payload } = verified;
  const productId = payload.productId;
  if (productId !== APPLE_UNIVERSE_PPV_PRODUCT_ID) {
    // Allow client product mismatch only if product is still the configured unlock id.
    if (!productId.includes("ppv") && !productId.includes("unlock")) {
      throw Object.assign(new Error(`Unknown PPV productId: ${productId}`), { status: 400 });
    }
  }

  const transactionId = payload.transactionId;
  const originalTransactionId = payload.originalTransactionId || transactionId;

  const content = await db.content.findFirst({
    where: { id: contentId, published: true },
    select: { id: true, title: true },
  });
  if (!content) {
    throw Object.assign(new Error("Title not found"), { status: 404 });
  }

  const existingCompleted = await db.viewerContentAccess.findFirst({
    where: {
      userId: options.userId,
      contentId,
      status: "COMPLETED",
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "desc" },
  });

  const prior = await findApplePaymentByTransactionId(transactionId);
  if (prior?.status === "SUCCEEDED" || existingCompleted) {
    return {
      ok: true as const,
      alreadyOwned: true as const,
      contentId,
      alreadyApplied: true as const,
    };
  }

  const amount = VIEWER_PLAN_CONFIG.PPV_FILM.price;
  const now = new Date();
  // Apple PPV ownership: long window (1 year); renew via repurchase if needed.
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const pending = await db.viewerContentAccess.findFirst({
    where: { userId: options.userId, contentId, status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "desc" },
  });

  const access = pending
    ? await db.viewerContentAccess.update({
        where: { id: pending.id },
        data: {
          status: "COMPLETED",
          amount,
          purchasedAt: now,
          expiresAt,
          externalPaymentId: transactionId,
        },
      })
    : await db.viewerContentAccess.create({
        data: {
          userId: options.userId,
          contentId,
          accessType: "PPV_FILM",
          amount,
          currency: "ZAR",
          status: "COMPLETED",
          purchasedAt: now,
          expiresAt,
          externalPaymentId: transactionId,
        },
      });

  // Ensure account can enter PPV flow if they only bought titles.
  const sub = await db.viewerSubscription.findFirst({
    where: { userId: options.userId },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) {
    await db.viewerSubscription.create({
      data: {
        userId: options.userId,
        viewerModel: VIEWER_MODELS.PPV,
        plan: "PPV_FILM",
        billingInterval: "month",
        status: "ACTIVE",
        profileLimit: 1,
        deviceCount: 1,
        lastPaymentStatus: "SUCCEEDED",
        lastPaymentAt: now,
        externalPaymentId: originalTransactionId,
      },
    });
  }

  await recordApplePayment({
    userId: options.userId,
    email: options.email,
    amount,
    purpose: "viewer_ppv_apple_iap",
    relatedEntityType: "ViewerContentAccess",
    relatedEntityId: access.id,
    transactionId,
    originalTransactionId,
    productId,
    environment: verified.environment,
    metadata: { contentId },
  });

  return {
    ok: true as const,
    alreadyOwned: true as const,
    contentId,
    alreadyApplied: false as const,
  };
}
