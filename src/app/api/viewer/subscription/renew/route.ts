import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processViewerSubscriptionCharge } from "@/lib/payments/subscription-billing";
import { createPayFastCardConsentForUser, getPayFastTokenForUser } from "@/lib/payments/payfast-saved-card";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import { isPayFastConfigured } from "@/lib/payments/config";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await prisma.viewerSubscription.findFirst({
    where: { userId: user.id, viewerModel: "SUBSCRIPTION" },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }

  const token = await getPayFastTokenForUser(user.id);
  if (!token) {
    if (!isPayFastConfigured()) {
      return NextResponse.json(
        {
          error: "No card on file for automatic renewal. PayFast is not configured.",
          reason: "missing_card_consent",
        },
        { status: 402 },
      );
    }
    try {
      const consent = await createPayFastCardConsentForUser({
        userId: user.id,
        email: user.email,
        name: user.name,
        returnPath: "/browse/account",
        returnUrl: buildPaymentReturnUrl("/browse/account", "payfast_card_consent"),
      });
      return NextResponse.json(
        {
          error: "Add a card to enable automatic monthly billing, then try again.",
          reason: "missing_card_consent",
          cardConsentUrl: consent.checkoutUrl,
        },
        { status: 402 },
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unable to start card setup.",
          reason: "missing_card_consent",
        },
        { status: 402 },
      );
    }
  }

  const charge = await processViewerSubscriptionCharge(subscription.id);
  if (!charge.ok) {
    if (charge.reason === "missing_card_consent" && isPayFastConfigured()) {
      try {
        const consent = await createPayFastCardConsentForUser({
          userId: user.id,
          email: user.email,
          name: user.name,
          returnPath: "/browse/account",
          returnUrl: buildPaymentReturnUrl("/browse/account", "payfast_card_consent"),
        });
        return NextResponse.json(
          {
            error: "Add a PayFast card to continue your subscription.",
            reason: "missing_card_consent",
            cardConsentUrl: consent.checkoutUrl,
          },
          { status: 402 },
        );
      } catch {
        /* fall through */
      }
    }
    return NextResponse.json(
      { error: "Unable to process renewal with saved card.", reason: charge.reason },
      { status: 402 },
    );
  }
  const updated = await prisma.viewerSubscription.findUnique({
    where: { id: subscription.id },
    select: { currentPeriodEnd: true },
  });
  return NextResponse.json({ success: true, renewedUntil: updated?.currentPeriodEnd?.toISOString() ?? null });
}
