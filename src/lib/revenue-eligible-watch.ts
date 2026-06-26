import { prisma } from "./prisma";
import {
  VIEWER_MODELS,
  getLatestViewerSubscription,
  getViewerModel,
  hasValidViewerContentAccess,
} from "./viewer-access";

/** Prisma filter for watch sessions that count toward creator revenue share. */
export const revenueEligibleWatchSessionWhere = {
  countsForCreatorRevenue: true,
} as const;

/**
 * Whether a new watch session should count toward creator revenue.
 * Free-trial catalogue viewers are excluded until they pay.
 */
export async function resolveWatchCountsForCreatorRevenue(
  userId: string,
  contentId: string,
): Promise<boolean> {
  const subscription = await getLatestViewerSubscription(userId);
  if (!subscription) return false;

  if (getViewerModel(subscription) === VIEWER_MODELS.PPV) {
    const access = await prisma.viewerContentAccess.findFirst({
      where: {
        userId,
        contentId,
        status: "COMPLETED",
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: "desc" },
    });
    return hasValidViewerContentAccess(access);
  }

  if (subscription.status === "TRIAL_ACTIVE") {
    return false;
  }

  if (subscription.status === "ACTIVE") {
    return subscription.lastPaymentStatus === "SUCCEEDED";
  }

  return subscription.lastPaymentStatus === "SUCCEEDED";
}
