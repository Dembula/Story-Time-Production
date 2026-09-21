import { prisma } from "@/lib/prisma";
import { getPayFastTokenForUser } from "@/lib/payments/payfast-saved-card";
import { isViewerAccountOnboardingComplete } from "@/lib/viewer-account-onboarding";

export const VIEWER_CARD_REMINDER_TYPE = "VIEWER_PAYMENT_SETUP";
export const VIEWER_CARD_REMINDER_PATH = "/browse/settings?focus=payment#settings-payment-methods";

function reminderCopy(accountIncomplete: boolean) {
  return {
    title: "Keep your subscription going",
    body: accountIncomplete
      ? "Thank you for subscribing. Save your card in your profile, and finish any account details that are still open, so we can renew you when this cycle ends. This reminder stays until your card is saved."
      : "Thank you for subscribing. Save your card in your profile so we can renew it for you when this billing cycle ends. It only takes a moment, and this reminder goes away once your card is saved.",
  };
}

export async function clearViewerCardReminder(userId: string) {
  await prisma.notification.deleteMany({
    where: { userId, type: VIEWER_CARD_REMINDER_TYPE },
  });
}

/** Bell reminder for paid subscribers who still have no card we can charge next cycle. */
export async function syncViewerCardReminder(userId: string, options?: { resurface?: boolean }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phoneNumber: true,
      accountOnboardingCompletedAt: true,
      viewerSubscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, viewerModel: true, status: true, lastPaymentStatus: true },
      },
    },
  });

  const sub = user?.viewerSubscriptions[0] ?? null;
  const paidOnStoryTime = Boolean(
    sub &&
      sub.viewerModel === "SUBSCRIPTION" &&
      sub.status === "ACTIVE" &&
      sub.lastPaymentStatus === "SUCCEEDED",
  );

  const appleSubscription =
    paidOnStoryTime && sub
      ? await prisma.paymentRecord.findFirst({
          where: {
            userId,
            provider: "APPLE",
            status: "SUCCEEDED",
            relatedEntityType: "ViewerSubscription",
            relatedEntityId: sub.id,
          },
          select: { id: true },
        })
      : null;

  const savedCard = paidOnStoryTime && !appleSubscription ? await getPayFastTokenForUser(userId) : null;
  const needsCard = Boolean(paidOnStoryTime && !appleSubscription && !savedCard);

  if (!needsCard) {
    await clearViewerCardReminder(userId);
    return;
  }

  const accountIncomplete = user ? !isViewerAccountOnboardingComplete(user) : false;
  const { title, body } = reminderCopy(accountIncomplete);
  const metadata = JSON.stringify({ url: VIEWER_CARD_REMINDER_PATH });

  const existing = await prisma.notification.findMany({
    where: { userId, type: VIEWER_CARD_REMINDER_TYPE },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (existing.length === 0) {
    await prisma.notification.create({
      data: {
        userId,
        type: VIEWER_CARD_REMINDER_TYPE,
        title,
        body,
        metadata,
        read: false,
      },
    });
    return;
  }

  const [keep, ...extras] = existing;
  if (extras.length > 0) {
    await prisma.notification.deleteMany({
      where: { id: { in: extras.map((row) => row.id) } },
    });
  }

  await prisma.notification.update({
    where: { id: keep.id },
    data: options?.resurface
      ? { title, body, metadata, read: false, createdAt: new Date() }
      : { title, body, metadata },
  });
}
