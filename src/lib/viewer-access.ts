import { prisma } from "./prisma";
import { getViewerPlanConfigById, VIEWER_PLAN_CONFIG } from "./pricing";

export { VIEWER_PLAN_CONFIG } from "./pricing";

export const VIEWER_MODELS = {
  SUBSCRIPTION: "SUBSCRIPTION",
  PPV: "PPV",
} as const;

type ViewerSubscriptionLike = {
  plan: string;
  status: string;
  trialEndsAt?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  deviceCount?: number | null;
  viewerModel?: string | null;
  profileLimit?: number | null;
};

type ViewerContentAccessLike = {
  status: string;
  expiresAt: Date | string;
};

export function getViewerModel(subscription?: ViewerSubscriptionLike | null) {
  return subscription?.viewerModel === VIEWER_MODELS.PPV ? VIEWER_MODELS.PPV : VIEWER_MODELS.SUBSCRIPTION;
}

export function getViewerPlanConfig(plan?: string | null) {
  return getViewerPlanConfigById(plan);
}

export function getViewerProfileLimit(subscription?: ViewerSubscriptionLike | null) {
  if (subscription?.profileLimit && subscription.profileLimit > 0) return subscription.profileLimit;
  return getViewerPlanConfig(subscription?.plan).profileLimit;
}

export function getViewerDeviceCount(subscription?: ViewerSubscriptionLike | null) {
  if (subscription?.deviceCount && subscription.deviceCount > 0) return subscription.deviceCount;
  return getViewerPlanConfig(subscription?.plan).deviceCount;
}

export function isViewerSubscriptionExpired(subscription?: ViewerSubscriptionLike | null) {
  if (!subscription) return true;

  if (getViewerModel(subscription) === VIEWER_MODELS.PPV) {
    return subscription.status === "PAST_DUE" || subscription.status === "CANCELLED";
  }

  const now = new Date();
  const trialExpired =
    subscription.status === "TRIAL_ACTIVE" &&
    !!subscription.trialEndsAt &&
    new Date(subscription.trialEndsAt) < now;
  const periodExpired =
    subscription.status === "ACTIVE" &&
    !!subscription.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd) < now;

  return trialExpired || periodExpired || subscription.status === "PAST_DUE" || subscription.status === "CANCELLED";
}

/** Trial window ended but subscription row may still be TRIAL_ACTIVE until billing runs. */
export function isExpiredTrialSubscription(subscription?: ViewerSubscriptionLike | null) {
  if (!subscription || subscription.status !== "TRIAL_ACTIVE") return false;
  if (!subscription.trialEndsAt) return false;
  return new Date(subscription.trialEndsAt) < new Date();
}

/** Viewer must pay or pick a new plan (post-trial, failed renewal, cancelled, lapsed period). */
export function subscriptionNeedsReactivation(subscription?: ViewerSubscriptionLike | null) {
  if (!subscription) return false;
  if (subscription.status === "PAST_DUE" || subscription.status === "CANCELLED") return true;
  if (isExpiredTrialSubscription(subscription)) return true;
  if (subscription.status === "ACTIVE" && isViewerSubscriptionExpired(subscription)) return true;
  return false;
}

/** Blocks creating a second subscription while access is still valid. */
export function hasBlockingActiveSubscription(subscription?: ViewerSubscriptionLike | null) {
  if (!subscription) return false;
  if (subscription.status === "ACTIVE") {
    return !isViewerSubscriptionExpired(subscription);
  }
  if (subscription.status === "TRIAL_ACTIVE") {
    return !isExpiredTrialSubscription(subscription);
  }
  return false;
}

/** Initial "Pay now" or failed renewal — payment must succeed before catalogue access. */
export function subscriptionPaymentRequired(subscription?: ViewerSubscriptionLike | null) {
  if (!subscription) return false;
  if (getViewerModel(subscription) === VIEWER_MODELS.PPV) return false;
  return subscription.status === "PAST_DUE";
}

export function hasActiveCatalogueSubscription(subscription?: ViewerSubscriptionLike | null) {
  return getViewerModel(subscription) === VIEWER_MODELS.SUBSCRIPTION && !isViewerSubscriptionExpired(subscription);
}

export function hasActivePpvViewerModel(subscription?: ViewerSubscriptionLike | null) {
  return getViewerModel(subscription) === VIEWER_MODELS.PPV && !isViewerSubscriptionExpired(subscription);
}

export function hasValidViewerContentAccess(access?: ViewerContentAccessLike | null) {
  if (!access || access.status !== "COMPLETED") return false;
  return new Date(access.expiresAt) > new Date();
}

export function isPpvEligibleContent(type?: string | null) {
  return !!type && !/music/i.test(type);
}

export async function getLatestViewerSubscription(userId: string) {
  return prisma.viewerSubscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLatestViewerContentAccess(userId: string, contentId: string) {
  return prisma.viewerContentAccess.findFirst({
    where: {
      userId,
      contentId,
      status: "COMPLETED",
    },
    orderBy: { expiresAt: "desc" },
  });
}

export async function getViewerPlaybackState(userId: string, contentId: string) {
  const [subscription, contentAccess] = await Promise.all([
    getLatestViewerSubscription(userId),
    getLatestViewerContentAccess(userId, contentId),
  ]);

  const viewerModel = getViewerModel(subscription);
  const subscriptionExpired = isViewerSubscriptionExpired(subscription);
  const hasCatalogueSubscription = hasActiveCatalogueSubscription(subscription);
  const hasActivePpvAccess = hasValidViewerContentAccess(contentAccess);

  return {
    subscription,
    viewerModel,
    subscriptionExpired,
    hasCatalogueSubscription,
    hasActivePpvAccess,
    canPlayContent: hasCatalogueSubscription || hasActivePpvAccess,
    contentAccess,
  };
}
