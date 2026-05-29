import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VIEWER_PLAN_CONFIG } from "@/lib/viewer-access";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const subscription = await prisma.viewerSubscription.findFirst({
    where: { userId: user.id, status: "PAST_DUE" },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) {
    return NextResponse.json({ error: "No pending subscription payment found." }, { status: 404 });
  }

  const planConfig =
    VIEWER_PLAN_CONFIG[subscription.plan as keyof typeof VIEWER_PLAN_CONFIG] ?? VIEWER_PLAN_CONFIG.BASE_1;

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
      metadata: { planType: subscription.plan, resume: true },
    });

    return NextResponse.json({ checkoutUrl: checkout.checkout.checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
