import { VIEWER_PLAN_CONFIG } from "@/lib/pricing";
import {
  VIEWER_MODELS,
  getViewerModel,
  isInitialSubscriptionPaymentPending,
  isViewerSubscriptionExpired,
  subscriptionNeedsReactivation,
} from "@/lib/viewer-access";

type ViewerSubscriptionLike = {
  plan: string;
  status: string;
  viewerModel?: string | null;
  trialEndsAt?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  lastPaymentStatus?: string | null;
  renewalAttemptCount?: number | null;
  pastDueSince?: Date | string | null;
};

export type PlanChangeChargeType = "full" | "upgrade_delta" | "none";

export type PlanChangeQuote = {
  currentPlan: string;
  newPlan: string;
  currentViewerModel: string;
  newViewerModel: string;
  currentPrice: number;
  newPrice: number;
  chargeAmount: number;
  chargeType: PlanChangeChargeType;
  isUpgrade: boolean;
  isDowngrade: boolean;
  requiresCheckout: boolean;
};

export function getViewerPlanPrice(planId: string): number {
  const config = VIEWER_PLAN_CONFIG[planId as keyof typeof VIEWER_PLAN_CONFIG];
  return config?.price ?? 0;
}

function hasPaidCurrentBillingPeriod(subscription: ViewerSubscriptionLike): boolean {
  if (subscription.lastPaymentStatus === "SUCCEEDED") return true;
  if (subscription.status === "ACTIVE" && subscription.currentPeriodEnd) {
    return new Date(subscription.currentPeriodEnd) > new Date();
  }
  return false;
}

/** Quote what a viewer should pay when switching plan or model mid-cycle. */
export function quoteViewerPlanChange(
  subscription: ViewerSubscriptionLike,
  newPlan: string,
  newViewerModel: string = VIEWER_MODELS.SUBSCRIPTION,
): PlanChangeQuote {
  const currentViewerModel = getViewerModel(subscription);
  const currentPrice =
    currentViewerModel === VIEWER_MODELS.PPV
      ? 0
      : getViewerPlanPrice(subscription.plan);
  const newPrice =
    newViewerModel === VIEWER_MODELS.PPV ? 0 : getViewerPlanPrice(newPlan);

  const needsFullPrice =
    subscriptionNeedsReactivation(subscription) ||
    isInitialSubscriptionPaymentPending(subscription) ||
    isViewerSubscriptionExpired(subscription) ||
    subscription.status === "TRIAL_ACTIVE" ||
    !hasPaidCurrentBillingPeriod(subscription);

  const sameSelection =
    currentViewerModel === newViewerModel &&
    (newViewerModel === VIEWER_MODELS.PPV || subscription.plan === newPlan);

  if (sameSelection && !needsFullPrice) {
    return {
      currentPlan: subscription.plan,
      newPlan,
      currentViewerModel,
      newViewerModel,
      currentPrice,
      newPrice,
      chargeAmount: 0,
      chargeType: "none",
      isUpgrade: false,
      isDowngrade: false,
      requiresCheckout: false,
    };
  }

  if (sameSelection && needsFullPrice && newViewerModel !== VIEWER_MODELS.PPV) {
    return {
      currentPlan: subscription.plan,
      newPlan,
      currentViewerModel,
      newViewerModel,
      currentPrice,
      newPrice,
      chargeAmount: newPrice,
      chargeType: "full",
      isUpgrade: false,
      isDowngrade: false,
      requiresCheckout: newPrice > 0,
    };
  }

  if (newViewerModel === VIEWER_MODELS.PPV) {
    return {
      currentPlan: subscription.plan,
      newPlan,
      currentViewerModel,
      newViewerModel,
      currentPrice,
      newPrice: 0,
      chargeAmount: 0,
      chargeType: "none",
      isUpgrade: false,
      isDowngrade: currentViewerModel === VIEWER_MODELS.SUBSCRIPTION,
      requiresCheckout: false,
    };
  }

  if (needsFullPrice) {
    return {
      currentPlan: subscription.plan,
      newPlan,
      currentViewerModel,
      newViewerModel,
      currentPrice,
      newPrice,
      chargeAmount: newPrice,
      chargeType: "full",
      isUpgrade: newPrice > currentPrice,
      isDowngrade: newPrice < currentPrice,
      requiresCheckout: newPrice > 0,
    };
  }

  if (newPrice > currentPrice) {
    const delta = Math.round((newPrice - currentPrice) * 100) / 100;
    return {
      currentPlan: subscription.plan,
      newPlan,
      currentViewerModel,
      newViewerModel,
      currentPrice,
      newPrice,
      chargeAmount: delta,
      chargeType: "upgrade_delta",
      isUpgrade: true,
      isDowngrade: false,
      requiresCheckout: delta > 0,
    };
  }

  return {
    currentPlan: subscription.plan,
    newPlan,
    currentViewerModel,
    newViewerModel,
    currentPrice,
    newPrice,
    chargeAmount: 0,
    chargeType: "none",
    isUpgrade: false,
    isDowngrade: newPrice < currentPrice,
    requiresCheckout: false,
  };
}

export function resolveViewerPlanType(plan?: string) {
  if (plan === "STANDARD_3") return "STANDARD_3";
  if (plan === "FAMILY_5") return "FAMILY_5";
  if (plan === "PPV_FILM") return "PPV_FILM";
  return "BASE_1";
}

export function resolveViewerModelChoice(viewerModel?: string): (typeof VIEWER_MODELS)[keyof typeof VIEWER_MODELS] {
  return viewerModel === VIEWER_MODELS.PPV ? VIEWER_MODELS.PPV : VIEWER_MODELS.SUBSCRIPTION;
}
