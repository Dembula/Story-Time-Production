import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VIEWER_MODELS, VIEWER_PLAN_CONFIG } from "@/lib/viewer-access";
import { computeDiscountedAmount, redeemPromoCode, resolvePromoCode } from "@/lib/promo-codes";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import { addViewerSubscriptionPeriod } from "@/lib/payments/billing-interval";
import {
  quoteViewerPlanChange,
  resolveViewerModelChoice,
  resolveViewerPlanType,
} from "@/lib/payments/viewer-plan-proration";

function promoFailureMessage(reason: string) {
  switch (reason) {
    case "expired":
      return "Promo code has expired.";
    case "not_started":
      return "Promo code is not active yet.";
    case "limit_reached":
      return "Promo code redemption limit reached.";
    case "already_used":
      return "Promo code already used for this account.";
    case "target_mismatch":
      return "Promo code does not apply to this package.";
    default:
      return "Promo code could not be redeemed.";
  }
}

async function loadSubscriptionForUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (!user) return null;

  const subscription = await prisma.viewerSubscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return { user, subscription };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loaded = await loadSubscriptionForUser(session.user.email);
  if (!loaded?.subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const plan = resolveViewerPlanType(searchParams.get("plan") ?? undefined);
  const viewerModel = resolveViewerModelChoice(searchParams.get("viewerModel") ?? undefined);
  const quote = quoteViewerPlanChange(loaded.subscription, plan, viewerModel);

  return NextResponse.json({ quote });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const planType = resolveViewerPlanType(typeof body.plan === "string" ? body.plan : undefined);
  const selectedViewerModel = resolveViewerModelChoice(
    typeof body.viewerModel === "string" ? body.viewerModel : undefined,
  );
  const planConfig = VIEWER_PLAN_CONFIG[planType];

  const loaded = await loadSubscriptionForUser(session.user.email);
  if (!loaded) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const { user, subscription } = loaded;
  if (!subscription) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });

  const quote = quoteViewerPlanChange(subscription, planType, selectedViewerModel);
  if (!quote.requiresCheckout && quote.chargeType === "none") {
    if (quote.currentViewerModel === selectedViewerModel && quote.currentPlan === planType) {
      return NextResponse.json({ error: "You are already on this plan." }, { status: 400 });
    }
  }

  let appliedPromo: { id: string; code: string } | null = null;
  let finalPrice = quote.chargeAmount;

  if (
    selectedViewerModel === VIEWER_MODELS.SUBSCRIPTION &&
    quote.requiresCheckout &&
    typeof body.promoCode === "string" &&
    body.promoCode.trim()
  ) {
    const promoResult = await resolvePromoCode(body.promoCode, "VIEWER_SUBSCRIPTION");
    if ("error" in promoResult) {
      return NextResponse.json({ error: promoResult.error }, { status: 400 });
    }
    const alreadyUsed = await prisma.promoCodeRedemption.findUnique({
      where: {
        promoCodeId_userId_context: {
          promoCodeId: promoResult.promo.id,
          userId: user.id,
          context: "VIEWER_SUBSCRIPTION",
        },
      },
      select: { id: true },
    });
    if (alreadyUsed) {
      return NextResponse.json({ error: "Promo code already used for this account." }, { status: 400 });
    }
    finalPrice = computeDiscountedAmount(quote.chargeAmount, promoResult.promo);
    appliedPromo = { id: promoResult.promo.id, code: promoResult.promo.code };
  }

  const now = new Date();
  const returnPath = "/browse/account?updated=1";

  if (!quote.requiresCheckout) {
    const updated = await prisma.viewerSubscription.update({
      where: { id: subscription.id },
      data:
        selectedViewerModel === VIEWER_MODELS.PPV
          ? {
              viewerModel: VIEWER_MODELS.PPV,
              plan: "PPV_FILM",
              status: "ACTIVE",
              trialEndsAt: null,
              deviceCount: 1,
              profileLimit: 1,
              billingEmail: user.email,
              cancelAtPeriodEnd: false,
            }
          : {
              viewerModel: VIEWER_MODELS.SUBSCRIPTION,
              plan: planType,
              deviceCount: planConfig.deviceCount,
              profileLimit: planConfig.profileLimit,
              billingEmail: user.email,
              cancelAtPeriodEnd: false,
            },
    });

    return NextResponse.json({
      subscription: updated,
      quote,
      redirectTo: returnPath,
      requiresPayment: false,
      message:
        selectedViewerModel === VIEWER_MODELS.PPV
          ? "Switched to Pay Per View. You only pay when you unlock a title."
          : quote.isDowngrade
            ? "Plan updated. Your next renewal will use the lower monthly price."
            : "Plan updated.",
    });
  }

  const pendingUpdate =
    quote.chargeType === "upgrade_delta"
      ? {
          lastPaymentStatus: "PENDING" as const,
          lastPaymentError: null,
        }
      : {
          viewerModel: selectedViewerModel,
          plan: selectedViewerModel === VIEWER_MODELS.PPV ? "PPV_FILM" : planType,
          deviceCount: selectedViewerModel === VIEWER_MODELS.PPV ? 1 : planConfig.deviceCount,
          profileLimit: selectedViewerModel === VIEWER_MODELS.PPV ? 1 : planConfig.profileLimit,
          billingEmail: user.email,
          lastPaymentStatus: "PENDING" as const,
          lastPaymentError: null,
          cancelAtPeriodEnd: false,
          renewalAttemptCount: 0,
          pastDueSince: null,
          ...(quote.chargeType === "full"
            ? {
                status: "PAST_DUE" as const,
                trialEndsAt: null,
                currentPeriodEnd: addViewerSubscriptionPeriod(now),
              }
            : {
                status: subscription.status === "TRIAL_ACTIVE" ? ("PAST_DUE" as const) : subscription.status,
                trialEndsAt: null,
              }),
        };

  const updated = await prisma.viewerSubscription.update({
    where: { id: subscription.id },
    data: pendingUpdate,
  });

  if (appliedPromo) {
    const redemption = await redeemPromoCode({
      promoCodeId: appliedPromo.id,
      userId: user.id,
      context: "VIEWER_SUBSCRIPTION",
      referenceId: subscription.id,
      discountAmount: Math.max(0, quote.chargeAmount - finalPrice),
      resultingPlan: planType,
      metadata: {
        basePrice: quote.chargeAmount,
        finalPrice,
        planChange: true,
        chargeType: quote.chargeType,
      },
    });
    if (!redemption.ok) {
      return NextResponse.json({ error: promoFailureMessage(redemption.reason) }, { status: 400 });
    }
  }

  try {
    const purpose =
      quote.chargeType === "upgrade_delta"
        ? "viewer_subscription_plan_change"
        : quote.chargeType === "full"
          ? "viewer_subscription_reactivate"
          : "viewer_subscription";

    const checkout = await initializeCheckout({
      userId: user.id,
      email: user.email,
      customerName: user.name,
      amount: finalPrice,
      purpose,
      referenceType: "ViewerSubscription",
      referenceId: subscription.id,
      returnUrl: buildPaymentReturnUrl(returnPath, purpose),
      metadata: {
        planType,
        viewerModel: selectedViewerModel,
        previousPlan: subscription.plan,
        previousViewerModel: subscription.viewerModel,
        chargeType: quote.chargeType,
        planChange: true,
        baseCharge: quote.chargeAmount,
      },
    });

    return NextResponse.json({
      subscription: updated,
      quote: { ...quote, chargeAmount: finalPrice },
      redirectTo: returnPath,
      requiresPayment: true,
      deferCheckout: true,
      checkoutUrl: checkout.checkout.checkoutUrl,
      pricing: {
        basePrice: quote.chargeAmount,
        finalPrice,
        promoCode: appliedPromo?.code ?? null,
        discountAmount: Math.max(0, quote.chargeAmount - finalPrice),
      },
      message:
        quote.chargeType === "upgrade_delta"
          ? `Complete payment of ${finalPrice.toFixed(2)} to upgrade for the rest of this billing period.`
          : "Complete payment to activate your plan.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
    await prisma.viewerSubscription.update({
      where: { id: subscription.id },
      data: {
        lastPaymentStatus: "FAILED",
        lastPaymentError: message,
      },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
