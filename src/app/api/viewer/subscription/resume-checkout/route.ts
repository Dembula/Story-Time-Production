import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  VIEWER_MODELS,
  VIEWER_PLAN_CONFIG,
  getLatestViewerSubscription,
  getViewerModel,
  subscriptionNeedsReactivation,
} from "@/lib/viewer-access";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import { hasPendingGatewayPayment } from "@/lib/payments/pending-gateway-payment";

/** One-click PayFast checkout for the viewer's current subscription plan (reactivation). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const subscription = await getLatestViewerSubscription(user.id);
  if (!subscription) {
    return NextResponse.json({ error: "No subscription found." }, { status: 404 });
  }

  if (getViewerModel(subscription) !== VIEWER_MODELS.SUBSCRIPTION) {
    return NextResponse.json({ error: "PPV accounts do not use subscription checkout." }, { status: 400 });
  }

  const pending = await hasPendingGatewayPayment("ViewerSubscription", subscription.id);
  if (pending) {
    return NextResponse.json(
      { error: "A payment is already being processed. Please wait a moment and refresh." },
      { status: 409 },
    );
  }

  if (!subscriptionNeedsReactivation(subscription)) {
    return NextResponse.json({ error: "Your subscription does not require payment right now." }, { status: 400 });
  }

  const planConfig =
    VIEWER_PLAN_CONFIG[subscription.plan as keyof typeof VIEWER_PLAN_CONFIG] ?? VIEWER_PLAN_CONFIG.BASE_1;

  if (planConfig.price <= 0) {
    return NextResponse.json({ error: "Unable to determine plan price." }, { status: 400 });
  }

  try {
    const checkout = await initializeCheckout({
      userId: user.id,
      email: user.email,
      customerName: user.name,
      amount: planConfig.price,
      purpose: "viewer_subscription",
      referenceType: "ViewerSubscription",
      referenceId: subscription.id,
      returnUrl: buildPaymentReturnUrl("/profiles", "viewer_subscription"),
      metadata: { planType: subscription.plan, resume: true, reactivation: true },
    });

    return NextResponse.json({
      checkoutUrl: checkout.checkout.checkoutUrl,
      plan: subscription.plan,
      amount: planConfig.price,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
