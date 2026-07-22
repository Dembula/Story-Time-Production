import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  VIEWER_MODELS,
  VIEWER_PLAN_CONFIG,
  hasBlockingActiveSubscription,
  isInitialSubscriptionPaymentPending,
  subscriptionNeedsReactivation,
} from "@/lib/viewer-access";
import { computeDiscountedAmount, promoGrantPeriodEnd, redeemPromoCode, resolvePromoCode } from "@/lib/promo-codes";
import { initializeCheckout } from "@/lib/payments/billing";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import { addViewerSubscriptionPeriod } from "@/lib/payments/billing-interval";

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

function isRetryableConsentSetupError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not enabled") ||
    normalized.includes("invalid scope") ||
    normalized.includes("forbidden") ||
    normalized.includes("403") ||
    normalized.includes("consent")
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      viewerSubscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { payments: { orderBy: { createdAt: "desc" }, take: 10 } },
      },
    },
  });

  const sub = user?.viewerSubscriptions?.[0] ?? null;
  return NextResponse.json({ subscription: sub });
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
  const { plan, startTrial, viewerModel } = body as {
    plan?: string;
    startTrial?: boolean;
    viewerModel?: string;
    promoCode?: string;
  };

  const selectedViewerModel = viewerModel === VIEWER_MODELS.PPV ? VIEWER_MODELS.PPV : VIEWER_MODELS.SUBSCRIPTION;
  const planType =
    selectedViewerModel === VIEWER_MODELS.PPV
      ? "PPV_FILM"
      : plan === "STANDARD_3"
        ? "STANDARD_3"
        : plan === "FAMILY_5"
          ? "FAMILY_5"
          : "BASE_1";
  const planConfig = VIEWER_PLAN_CONFIG[planType];
  const useTrial = selectedViewerModel === VIEWER_MODELS.SUBSCRIPTION && !!startTrial;
  let appliedPromo:
    | {
        id: string;
        code: string;
        kind: string;
        amount: number | null;
      }
    | null = null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, accountOnboardingCompletedAt: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await prisma.viewerSubscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (existing && hasBlockingActiveSubscription(existing)) {
    return NextResponse.json({
      subscription: existing,
      profileId: null,
      redirectTo: "/browse",
      message: "Already have an active subscription",
    });
  }

  const initialPaymentPending = Boolean(existing && isInitialSubscriptionPaymentPending(existing));
  const reactivating = Boolean(existing && subscriptionNeedsReactivation(existing) && !initialPaymentPending);
  const postTrialReturnPath = user.accountOnboardingCompletedAt ? "/browse" : "/profiles";
  const checkoutReturnPath = user.accountOnboardingCompletedAt ? "/profiles" : "/onboarding/account";

  if (reactivating && existing) {
    if (selectedViewerModel === VIEWER_MODELS.PPV) {
      const updated = await prisma.viewerSubscription.update({
        where: { id: existing.id },
        data: {
          viewerModel: VIEWER_MODELS.PPV,
          plan: "PPV_FILM",
          status: "ACTIVE",
          trialEndsAt: null,
          deviceCount: 1,
          profileLimit: 1,
          billingEmail: user.email,
          lastPaymentStatus: "SUCCEEDED",
          lastPaymentError: null,
          lastPaymentAt: new Date(),
        },
      });
      return NextResponse.json({
        subscription: updated,
        profileId: null,
        redirectTo: postTrialReturnPath,
        requiresPayment: false,
        reactivated: true,
        message: "PPV access restored. Choose a title and pay when you are ready to watch.",
      });
    }

    const now = new Date();
    const basePrice: number = planConfig.price;
    let finalPrice: number = basePrice;

    if (typeof body.promoCode === "string" && body.promoCode.trim()) {
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
      finalPrice = computeDiscountedAmount(basePrice, promoResult.promo);
      appliedPromo = {
        id: promoResult.promo.id,
        code: promoResult.promo.code,
        kind: promoResult.promo.kind,
        amount: promoResult.promo.amount ?? null,
      };
    }

    const subscription = await prisma.viewerSubscription.update({
      where: { id: existing.id },
      data: {
        viewerModel: VIEWER_MODELS.SUBSCRIPTION,
        plan: planType,
        status: "PAST_DUE",
        trialEndsAt: null,
        deviceCount: planConfig.deviceCount,
        profileLimit: planConfig.profileLimit,
        billingEmail: user.email,
        lastPaymentStatus: "PENDING",
        lastPaymentError: null,
        cancelAtPeriodEnd: false,
        renewalAttemptCount: 0,
        pastDueSince: null,
        currentPeriodEnd: addViewerSubscriptionPeriod(now),
      },
    });

    if (appliedPromo) {
      const redemption = await redeemPromoCode({
        promoCodeId: appliedPromo.id,
        userId: user.id,
        context: "VIEWER_SUBSCRIPTION",
        referenceId: subscription.id,
        discountAmount: Math.max(0, basePrice - finalPrice),
        resultingPlan: planType,
        metadata: { basePrice, finalPrice, reactivation: true, fundingSource: finalPrice <= 0 ? "promo" : "cash" },
      });
      if (!redemption.ok) {
        return NextResponse.json({ error: promoFailureMessage(redemption.reason) }, { status: 400 });
      }
    }

    if (finalPrice <= 0 && appliedPromo) {
      const grantEnd = promoGrantPeriodEnd(now, appliedPromo, "year");
      const activated = await prisma.viewerSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          trialEndsAt: null,
          currentPeriodEnd: grantEnd,
          lastPaymentStatus: "PROMO",
          lastPaymentAt: now,
          lastPaymentError: null,
        },
      });
      return NextResponse.json({
        subscription: activated,
        profileId: null,
        redirectTo: postTrialReturnPath,
        requiresPayment: false,
        deferCheckout: false,
        checkoutUrl: null,
        reactivated: true,
        pricing: {
          basePrice,
          finalPrice: 0,
          promoCode: appliedPromo.code,
          discountAmount: Math.max(0, basePrice - finalPrice),
          fundingSource: "promo",
        },
        message: "Promo applied. Subscription restarted for the promo period — no payment was charged.",
      });
    }

    try {
      const checkout = await initializeCheckout({
        userId: user.id,
        email: user.email,
        customerName: user.name,
        amount: finalPrice,
        purpose: "viewer_subscription",
        referenceType: "ViewerSubscription",
        referenceId: subscription.id,
        returnUrl: buildPaymentReturnUrl(postTrialReturnPath, "viewer_subscription_reactivate"),
        metadata: { planType, reactivation: true, tokenize: true },
      });

      return NextResponse.json({
        subscription,
        profileId: null,
        redirectTo: postTrialReturnPath,
        requiresPayment: false,
        deferCheckout: true,
        checkoutUrl: checkout.checkout.checkoutUrl,
        reactivated: true,
        pricing: {
          basePrice,
          finalPrice,
          promoCode: appliedPromo?.code ?? null,
          discountAmount: Math.max(0, basePrice - finalPrice),
        },
        message: "Complete payment to restart your subscription.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
      await prisma.viewerSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "PAST_DUE",
          lastPaymentStatus: "FAILED",
          lastPaymentError: message,
        },
      });
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (initialPaymentPending && existing) {
    if (selectedViewerModel === VIEWER_MODELS.PPV) {
      const updated = await prisma.viewerSubscription.update({
        where: { id: existing.id },
        data: {
          viewerModel: VIEWER_MODELS.PPV,
          plan: "PPV_FILM",
          status: "ACTIVE",
          trialEndsAt: null,
          deviceCount: 1,
          profileLimit: 1,
          billingEmail: user.email,
          lastPaymentStatus: null,
          lastPaymentError: null,
          lastPaymentAt: null,
          cancelAtPeriodEnd: false,
          renewalAttemptCount: 0,
          pastDueSince: null,
        },
      });

      return NextResponse.json({
        subscription: updated,
        profileId: null,
        redirectTo: checkoutReturnPath,
        requiresPayment: false,
      });
    }

    const now = new Date();
    const basePrice: number = planConfig.price;
    let finalPrice: number = basePrice;
    if (typeof body.promoCode === "string" && body.promoCode.trim()) {
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
      finalPrice = computeDiscountedAmount(basePrice, promoResult.promo);
      appliedPromo = {
        id: promoResult.promo.id,
        code: promoResult.promo.code,
        kind: promoResult.promo.kind,
        amount: promoResult.promo.amount ?? null,
      };
    }

    const trialEndsAt = useTrial ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
    const currentPeriodEnd =
      useTrial && trialEndsAt ? addViewerSubscriptionPeriod(trialEndsAt) : addViewerSubscriptionPeriod(now);
    const subscription = await prisma.viewerSubscription.update({
      where: { id: existing.id },
      data: {
        viewerModel: VIEWER_MODELS.SUBSCRIPTION,
        plan: planType,
        status: useTrial ? "TRIAL_ACTIVE" : "PAST_DUE",
        trialEndsAt,
        currentPeriodEnd,
        deviceCount: planConfig.deviceCount,
        profileLimit: planConfig.profileLimit,
        billingEmail: user.email,
        lastPaymentStatus: "PENDING",
        lastPaymentAt: null,
        lastPaymentError: null,
        cancelAtPeriodEnd: false,
        renewalAttemptCount: 0,
        pastDueSince: null,
      },
    });

    if (appliedPromo) {
      const redemption = await redeemPromoCode({
        promoCodeId: appliedPromo.id,
        userId: user.id,
        context: "VIEWER_SUBSCRIPTION",
        referenceId: subscription.id,
        discountAmount: Math.max(0, basePrice - finalPrice),
        resultingPlan: planType,
        metadata: {
          basePrice,
          finalPrice,
          trialApplied: useTrial,
        },
      });
      if (!redemption.ok) {
        return NextResponse.json({ error: promoFailureMessage(redemption.reason) }, { status: 400 });
      }
    }

    let checkoutUrl: string | null = null;
    let checkoutWarning: string | null = null;
    if (finalPrice <= 0 && appliedPromo) {
      const grantEnd = promoGrantPeriodEnd(now, appliedPromo, "year");
      await prisma.viewerSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          trialEndsAt: null,
          currentPeriodEnd: grantEnd,
          lastPaymentStatus: "PROMO",
          lastPaymentAt: now,
          lastPaymentError: null,
          cancelAtPeriodEnd: false,
        },
      });
      return NextResponse.json({
        subscription: await prisma.viewerSubscription.findUnique({ where: { id: subscription.id } }),
        profileId: null,
        redirectTo: checkoutReturnPath,
        requiresPayment: false,
        deferCheckout: false,
        checkoutUrl: null,
        pricing: {
          basePrice,
          finalPrice: 0,
          promoCode: appliedPromo.code,
          discountAmount: Math.max(0, basePrice - finalPrice),
          fundingSource: "promo",
        },
        message: "Promo applied. Your subscription is active for the promo period — no payment was charged.",
      });
    }
    if (useTrial) {
      try {
        const gateway = getPaymentGateway();
        const consent = await gateway.createCardConsentSession({
          reference: `trial-consent-${subscription.id}`,
          returnUrl: buildPaymentReturnUrl("/onboarding/account", "viewer_trial_card_capture"),
          customer: { email: user.email, name: user.name, payerId: user.id },
        });
        checkoutUrl = consent.checkoutUrl;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to initialize card capture.";
        checkoutWarning = isRetryableConsentSetupError(message)
          ? "Trial started, but card capture is not available yet. PayFast integration is required before saved cards can be collected."
          : "Trial started, but card capture could not be initialized right now. You can add a payment method later in account settings.";
        await prisma.viewerSubscription.update({
          where: { id: subscription.id },
          data: { lastPaymentStatus: "PENDING", lastPaymentError: checkoutWarning },
        });
      }
    } else {
      try {
        const checkout = await initializeCheckout({
          userId: user.id,
          email: user.email,
          customerName: user.name,
          amount: finalPrice,
          purpose: "viewer_subscription",
          referenceType: "ViewerSubscription",
          referenceId: subscription.id,
          returnUrl: buildPaymentReturnUrl(checkoutReturnPath, "viewer_subscription"),
          metadata: { planType, tokenize: true },
        });
        checkoutUrl = checkout.checkout.checkoutUrl;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
        await prisma.viewerSubscription.update({
          where: { id: subscription.id },
          data: {
            status: "PAST_DUE",
            lastPaymentStatus: "FAILED",
            lastPaymentError: message,
          },
        });
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    const deferCheckout = !useTrial && Boolean(checkoutUrl);

    return NextResponse.json({
      subscription,
      profileId: null,
      redirectTo: checkoutReturnPath,
      requiresPayment: useTrial ? Boolean(checkoutUrl) : false,
      deferCheckout,
      checkoutUrl,
      checkoutWarning,
      pricing: {
        basePrice,
        finalPrice,
        promoCode: appliedPromo?.code ?? null,
        discountAmount: Math.max(0, basePrice - finalPrice),
      },
      message: useTrial
        ? "Trial activated. Add your card now for automatic billing at trial end."
        : "Subscription updated. Complete payment to activate full access.",
    });
  }

  if (selectedViewerModel === VIEWER_MODELS.PPV) {
    const subscription = await prisma.viewerSubscription.create({
      data: {
        userId: user.id,
        viewerModel: VIEWER_MODELS.PPV,
        plan: "PPV_FILM",
        status: "ACTIVE",
        deviceCount: 1,
        profileLimit: 1,
        billingEmail: user.email,
      },
    });

    return NextResponse.json({
      subscription,
      profileId: null,
      redirectTo: "/onboarding/account",
      requiresPayment: false,
    });
  }

  const now = new Date();
  const basePrice: number = planConfig.price;
  let finalPrice: number = basePrice;
  if (body && typeof body === "object" && typeof (body as { promoCode?: string }).promoCode === "string" && (body as { promoCode?: string }).promoCode?.trim()) {
    const promoResult = await resolvePromoCode((body as { promoCode?: string }).promoCode ?? "", "VIEWER_SUBSCRIPTION");
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
    finalPrice = computeDiscountedAmount(basePrice, promoResult.promo);
    appliedPromo = {
      id: promoResult.promo.id,
      code: promoResult.promo.code,
      kind: promoResult.promo.kind,
      amount: promoResult.promo.amount ?? null,
    };
  }
  const trialEndsAt = useTrial ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
  const currentPeriodEnd =
    useTrial && trialEndsAt ? addViewerSubscriptionPeriod(trialEndsAt) : addViewerSubscriptionPeriod(now);
  const subscription = await prisma.viewerSubscription.create({
    data: {
      userId: user.id,
      viewerModel: selectedViewerModel,
      plan: planType,
      status: useTrial ? "TRIAL_ACTIVE" : "PAST_DUE",
      trialEndsAt,
      currentPeriodEnd,
      deviceCount: planConfig.deviceCount,
      profileLimit: planConfig.profileLimit,
      billingEmail: user.email,
      lastPaymentStatus: useTrial ? "PENDING" : "PENDING",
      lastPaymentAt: null,
    },
  });

  if (appliedPromo) {
    const redemption = await redeemPromoCode({
      promoCodeId: appliedPromo.id,
      userId: user.id,
      context: "VIEWER_SUBSCRIPTION",
      referenceId: subscription.id,
      discountAmount: Math.max(0, basePrice - finalPrice),
      resultingPlan: planType,
      metadata: {
        basePrice,
        finalPrice,
        trialApplied: useTrial,
      },
    });
    if (!redemption.ok) {
      await prisma.viewerSubscription.delete({ where: { id: subscription.id } });
      return NextResponse.json({ error: promoFailureMessage(redemption.reason) }, { status: 400 });
    }
  }

  let checkoutUrl: string | null = null;
  let checkoutWarning: string | null = null;
  if (!useTrial && finalPrice <= 0 && appliedPromo) {
    const grantEnd = promoGrantPeriodEnd(now, appliedPromo, "year");
    const activated = await prisma.viewerSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        trialEndsAt: null,
        currentPeriodEnd: grantEnd,
        lastPaymentStatus: "PROMO",
        lastPaymentAt: now,
        lastPaymentError: null,
      },
    });
    return NextResponse.json({
      subscription: activated,
      profileId: null,
      redirectTo: "/onboarding/account",
      requiresPayment: false,
      deferCheckout: false,
      checkoutUrl: null,
      pricing: {
        basePrice,
        finalPrice: 0,
        promoCode: appliedPromo.code,
        discountAmount: Math.max(0, basePrice - finalPrice),
        fundingSource: "promo",
      },
      message: "Promo applied. Your subscription is active for the promo period — no payment was charged.",
    });
  }
  if (useTrial) {
    try {
      const gateway = getPaymentGateway();
      const consent = await gateway.createCardConsentSession({
        reference: `trial-consent-${subscription.id}`,
        returnUrl: buildPaymentReturnUrl("/onboarding/account", "viewer_trial_card_capture"),
        customer: { email: user.email, name: user.name, payerId: user.id },
      });
      checkoutUrl = consent.checkoutUrl;
      await prisma.viewerSubscription.update({
        where: { id: subscription.id },
        data: { lastPaymentStatus: "PENDING" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to initialize card capture.";
      checkoutWarning = isRetryableConsentSetupError(message)
        ? "Trial started, but card capture is not available yet. PayFast integration is required before saved cards can be collected."
        : "Trial started, but card capture could not be initialized right now. You can add a payment method later in account settings.";
      await prisma.viewerSubscription.update({
        where: { id: subscription.id },
        data: { lastPaymentStatus: "PENDING", lastPaymentError: checkoutWarning },
      });
    }
  } else {
    try {
      const checkout = await initializeCheckout({
        userId: user.id,
        email: user.email,
        customerName: user.name,
        amount: finalPrice,
        purpose: "viewer_subscription",
        referenceType: "ViewerSubscription",
        referenceId: subscription.id,
        returnUrl: buildPaymentReturnUrl("/onboarding/account", "viewer_subscription"),
        metadata: { planType, tokenize: true },
      });
      checkoutUrl = checkout.checkout.checkoutUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
      await prisma.viewerSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "PAST_DUE",
          lastPaymentStatus: "FAILED",
          lastPaymentError: message,
        },
      });
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const deferCheckout = !useTrial && Boolean(checkoutUrl);

  return NextResponse.json({
    subscription,
    profileId: null,
    redirectTo: "/onboarding/account",
    requiresPayment: useTrial ? Boolean(checkoutUrl) : false,
    deferCheckout,
    checkoutUrl,
    checkoutWarning,
    pricing: {
      basePrice,
      finalPrice,
      promoCode: appliedPromo?.code ?? null,
      discountAmount: Math.max(0, basePrice - finalPrice),
    },
    message: useTrial
      ? "Trial activated. Add your card now for automatic billing at trial end."
      : "Subscription created. Complete payment to activate full access.",
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    plan?: string;
    viewerModel?: string;
  } | null;

  const selectedViewerModel = body?.viewerModel === VIEWER_MODELS.PPV ? VIEWER_MODELS.PPV : VIEWER_MODELS.SUBSCRIPTION;
  const planType =
    selectedViewerModel === VIEWER_MODELS.PPV
      ? "PPV_FILM"
      : body?.plan === "STANDARD_3"
        ? "STANDARD_3"
        : body?.plan === "FAMILY_5"
          ? "FAMILY_5"
          : "BASE_1";
  const planConfig = VIEWER_PLAN_CONFIG[planType];

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const subscription = await prisma.viewerSubscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) {
    return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  }

  const paymentMethod = await prisma.viewerPaymentMethod.findFirst({
    where: { userId: user.id, isDefault: true },
  });

  if (!paymentMethod) {
    return NextResponse.json(
      { error: "Add a payment method before changing package" },
      { status: 400 }
    );
  }

  const updated = await prisma.viewerSubscription.update({
    where: { id: subscription.id },
    data: {
      viewerModel: selectedViewerModel,
      plan: planType,
      deviceCount: planConfig.deviceCount,
      profileLimit: planConfig.profileLimit,
      paymentMethodId: paymentMethod.id,
      billingEmail: subscription.billingEmail ?? user.email,
      status: "ACTIVE",
      lastPaymentStatus: "PENDING",
      lastPaymentError: null,
      lastPaymentAt: new Date(),
    },
  });

  return NextResponse.json({
    subscription: updated,
    message: "Package updated. Recurring billing will be charged through PayFast when your saved card is on file.",
  });
}
