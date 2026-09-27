import "server-only";

import { prisma } from "@/lib/prisma";
import { VIEWER_MODELS, VIEWER_PLAN_CONFIG } from "@/lib/viewer-access";
import { ppvTitleAccessExpiresAt } from "@/lib/pricing";
import {
  GOOGLE_UNIVERSE_PPV_PRODUCT_ID,
  resolveGoogleUniverseSubscriptionProduct,
} from "@/lib/payments/apple-iap/products";
import {
  detectGoogleStoreFreeTrial,
  storeTrialPaymentMeta,
} from "@/lib/payments/store-trial";

const db = prisma as any;

export type GoogleActivateBody = {
  productId?: string;
  purchaseToken?: string;
  orderId?: string | null;
  packageName?: string;
  plan?: string;
  planCode?: string;
  platform?: string;
  source?: string;
  kind?: string;
  contentId?: string;
  isFreeTrial?: boolean;
  freeTrial?: boolean;
  offerId?: string | null;
  trialEndsAt?: string | null;
  accessDays?: number;
};

function addBillingPeriod(from: Date, interval: "month" | "year"): Date {
  const next = new Date(from);
  if (interval === "year") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

async function findGooglePayment(purchaseToken: string) {
  return db.paymentRecord.findFirst({
    where: {
      provider: "GOOGLE",
      OR: [{ gatewayTransactionId: purchaseToken }, { providerPaymentId: purchaseToken }],
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Activate a Google Play Universe subscription.
 * Free trials are tracked when the Android client reports isFreeTrial / offerId,
 * or when Play Developer API verification is added later.
 */
export async function activateGoogleViewerSubscription(options: {
  userId: string;
  email?: string | null;
  body: GoogleActivateBody;
}) {
  const productId = String(options.body.productId ?? "").trim();
  const purchaseToken = String(options.body.purchaseToken ?? "").trim();
  if (!productId || !purchaseToken) {
    throw Object.assign(new Error("productId and purchaseToken are required"), { status: 400 });
  }

  const mapped = resolveGoogleUniverseSubscriptionProduct(productId);
  if (!mapped) {
    throw Object.assign(new Error(`Unknown Google subscription productId: ${productId}`), {
      status: 400,
    });
  }

  const prior = await findGooglePayment(purchaseToken);
  if (prior?.status === "SUCCEEDED" && prior.relatedEntityType === "ViewerSubscription" && prior.relatedEntityId) {
    if (prior.userId && prior.userId !== options.userId) {
      throw Object.assign(new Error("This Google purchase belongs to another account."), { status: 409 });
    }
    const sub = await db.viewerSubscription.findUnique({ where: { id: prior.relatedEntityId } });
    if (sub) {
      return {
        ok: true as const,
        alreadyApplied: true,
        plan: sub.plan,
        status: sub.status,
        subscriptionId: sub.id,
        isFreeTrial: sub.status === "TRIAL_ACTIVE",
        trialEndsAt: sub.trialEndsAt?.toISOString?.() ?? null,
      };
    }
  }

  const now = new Date();
  const trial = detectGoogleStoreFreeTrial({
    productId,
    isFreeTrial: options.body.isFreeTrial,
    freeTrial: options.body.freeTrial,
    offerId: options.body.offerId,
    trialEndsAt: options.body.trialEndsAt,
    now,
  });
  const isFreeTrial = trial.isFreeTrial;
  const trialEndsAt = isFreeTrial ? trial.trialEndsAt : null;
  const planCode = mapped.planCode;
  const planConfig = VIEWER_PLAN_CONFIG[planCode];
  const periodEnd =
    isFreeTrial && trialEndsAt ? trialEndsAt : addBillingPeriod(now, mapped.billingInterval);
  const orderId = String(options.body.orderId ?? purchaseToken).trim();

  const existing = await db.viewerSubscription.findFirst({
    where: { userId: options.userId },
    orderBy: { createdAt: "desc" },
  });

  const subData = {
    viewerModel: VIEWER_MODELS.SUBSCRIPTION,
    plan: planCode,
    billingInterval: mapped.billingInterval,
    status: isFreeTrial ? "TRIAL_ACTIVE" : "ACTIVE",
    trialEndsAt,
    currentPeriodEnd: periodEnd,
    deviceCount: planConfig.deviceCount,
    profileLimit: mapped.profileLimit,
    cancelAtPeriodEnd: false,
    lastPaymentStatus: isFreeTrial ? "TRIAL" : "SUCCEEDED",
    lastPaymentAt: now,
    lastPaymentError: null,
    renewalAttemptCount: 0,
    pastDueSince: null,
    externalPaymentId: orderId,
  };

  const subscription = existing
    ? await db.viewerSubscription.update({ where: { id: existing.id }, data: subData })
    : await db.viewerSubscription.create({
        data: { userId: options.userId, ...subData },
      });

  const amount = isFreeTrial
    ? 0
    : mapped.billingInterval === "year"
      ? planConfig.yearlyPrice
      : planConfig.price;

  const meta = {
    productId,
    purchaseToken,
    orderId,
    packageName: options.body.packageName ?? null,
    plan: planCode,
    billingInterval: mapped.billingInterval,
    source: "android_app",
    listPriceZar:
      mapped.billingInterval === "year" ? planConfig.yearlyPrice : planConfig.price,
    ...storeTrialPaymentMeta(trial),
  };

  if (prior) {
    await db.paymentRecord.update({
      where: { id: prior.id },
      data: {
        status: "SUCCEEDED",
        amount,
        paidAt: now,
        purpose: "viewer_subscription_google_play",
        relatedEntityType: "ViewerSubscription",
        relatedEntityId: subscription.id,
        providerPaymentId: purchaseToken,
        gatewayTransactionId: purchaseToken,
        settlementSource: isFreeTrial ? "free_trial" : "google_play",
        settlementAmount: isFreeTrial ? 0 : amount,
        providerFeeAmount: 0,
        metadata: meta,
      },
    });
  } else {
    await db.paymentRecord.create({
      data: {
        userId: options.userId,
        email: options.email ?? undefined,
        provider: "GOOGLE",
        purpose: "viewer_subscription_google_play",
        status: "SUCCEEDED",
        amount,
        currency: "ZAR",
        relatedEntityType: "ViewerSubscription",
        relatedEntityId: subscription.id,
        providerPaymentId: purchaseToken,
        gatewayTransactionId: purchaseToken,
        settlementSource: isFreeTrial ? "free_trial" : "google_play",
        settlementAmount: isFreeTrial ? 0 : amount,
        providerFeeAmount: 0,
        paidAt: now,
        metadata: meta,
      },
    });
  }

  return {
    ok: true as const,
    alreadyApplied: false,
    plan: planCode,
    status: isFreeTrial ? ("TRIAL_ACTIVE" as const) : ("ACTIVE" as const),
    subscriptionId: subscription.id,
    currentPeriodEnd: periodEnd.toISOString(),
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    isFreeTrial,
  };
}

export async function activateGoogleViewerPpv(options: {
  userId: string;
  email?: string | null;
  body: GoogleActivateBody;
}) {
  const contentId = options.body.contentId?.trim();
  const productId = String(options.body.productId ?? "").trim();
  const purchaseToken = String(options.body.purchaseToken ?? "").trim();
  if (!contentId || !productId || !purchaseToken) {
    throw Object.assign(new Error("contentId, productId, and purchaseToken are required"), {
      status: 400,
    });
  }
  if (productId !== GOOGLE_UNIVERSE_PPV_PRODUCT_ID && !productId.includes("ppv")) {
    throw Object.assign(new Error(`Unknown Google PPV productId: ${productId}`), { status: 400 });
  }

  const prior = await findGooglePayment(purchaseToken);
  if (prior?.status === "SUCCEEDED") {
    return { ok: true as const, alreadyOwned: true as const, contentId, alreadyApplied: true as const };
  }

  const content = await db.content.findFirst({
    where: { id: contentId, published: true },
    select: { id: true },
  });
  if (!content) {
    throw Object.assign(new Error("Title not found"), { status: 404 });
  }

  const amount = VIEWER_PLAN_CONFIG.PPV_FILM.price;
  const now = new Date();
  const expiresAt = ppvTitleAccessExpiresAt(now);

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
          externalPaymentId: purchaseToken,
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
          externalPaymentId: purchaseToken,
        },
      });

  await db.paymentRecord.create({
    data: {
      userId: options.userId,
      email: options.email ?? undefined,
      provider: "GOOGLE",
      purpose: "viewer_ppv_google_play",
      status: "SUCCEEDED",
      amount,
      currency: "ZAR",
      relatedEntityType: "ViewerContentAccess",
      relatedEntityId: access.id,
      providerPaymentId: purchaseToken,
      gatewayTransactionId: purchaseToken,
      settlementSource: "google_play",
      settlementAmount: amount,
      providerFeeAmount: 0,
      paidAt: now,
      metadata: {
        productId,
        purchaseToken,
        orderId: options.body.orderId ?? null,
        contentId,
        source: "android_app",
      },
    },
  });

  return {
    ok: true as const,
    alreadyOwned: true as const,
    contentId,
    alreadyApplied: false as const,
  };
}
