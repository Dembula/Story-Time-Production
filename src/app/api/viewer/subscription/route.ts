import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VIEWER_MODELS, VIEWER_PLAN_CONFIG } from "@/lib/viewer-access";
import { computeDiscountedAmount, redeemPromoCode, resolvePromoCode } from "@/lib/promo-codes";

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

  const body = await req.json();
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

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await prisma.viewerSubscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (existing && (existing.status === "TRIAL_ACTIVE" || existing.status === "ACTIVE")) {
    return NextResponse.json({
      subscription: existing,
      profileId: null,
      redirectTo: "/profiles",
      message: "Already have an active subscription",
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
      redirectTo: "/profiles",
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
  const currentPeriodEnd = new Date(
    now.getTime() + (useTrial ? 37 : 30) * 24 * 60 * 60 * 1000,
  );
  const subscription = await prisma.viewerSubscription.create({
    data: {
      userId: user.id,
      viewerModel: selectedViewerModel,
      plan: planType,
      status: useTrial ? "TRIAL_ACTIVE" : "ACTIVE",
      trialEndsAt,
      currentPeriodEnd,
      deviceCount: planConfig.deviceCount,
      profileLimit: planConfig.profileLimit,
      billingEmail: user.email,
      lastPaymentStatus: "DISABLED",
      lastPaymentAt: now,
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

  return NextResponse.json({
    subscription,
    profileId: null,
    redirectTo: "/profiles",
    requiresPayment: false,
    pricing: {
      basePrice,
      finalPrice,
      promoCode: appliedPromo?.code ?? null,
      discountAmount: Math.max(0, basePrice - finalPrice),
    },
    message: "Subscription activated without payment gateway checkout.",
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
    message: "Package updated. Connect Paystack charging in this flow when ready.",
  });
}
