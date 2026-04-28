import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCreatorStudioProfilesForUser, loadStudioPipelineContext } from "@/lib/creator-studio";
import { defaultSuiteAccessOpen } from "@/lib/creator-suite-access";
import { isMissingCreatorStudioInfrastructure } from "@/lib/prisma-missing-table";
import { CREATOR_LICENSE_CONFIG, CREATOR_LICENSE_TYPE, CREATOR_ONBOARDING_PLANS, formatCreatorLicenseSummary } from "@/lib/pricing";
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
      return "Promo code already used for this creator account.";
    case "target_mismatch":
      return "Promo code does not apply to this package.";
    default:
      return "Promo code could not be redeemed.";
  }
}

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !(session.user as { id?: string }).id) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        license: null,
        pipelineAccess: false,
        planSummary: null,
        licensePeriodActive: false,
        activeStudioProfile: null,
      },
      { status: 401 },
    );
  }

  const userId = (session.user as { id: string }).id;

  const role = (session.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({
      license: null,
      pipelineAccess: false,
      planSummary: null,
      licensePeriodActive: false,
      activeStudioProfile: null,
    });
  }

  await ensureCreatorStudioProfilesForUser(userId);
  const ctx = await loadStudioPipelineContext(userId);
  const license = ctx?.license ?? null;
  return NextResponse.json({
    license,
    pipelineAccess: ctx?.pipelineAccess ?? false,
    suiteAccess: ctx?.suiteAccess ?? defaultSuiteAccessOpen(),
    planSummary: license ? formatCreatorLicenseSummary(license.type) : null,
    licensePeriodActive: ctx?.licensePeriodActive ?? false,
    activeStudioProfile: ctx?.activeProfile ?? null,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const role = (session.user as { role?: string })?.role;
  if (!user || (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.creatorDistributionLicense.findUnique({ where: { userId: user.id } });
  if (existing) {
    await ensureCreatorStudioProfilesForUser(user.id);
    const ctx = await loadStudioPipelineContext(user.id);
    return NextResponse.json({
      license: existing,
      pipelineAccess: ctx?.pipelineAccess ?? false,
      suiteAccess: ctx?.suiteAccess ?? defaultSuiteAccessOpen(),
      planSummary: formatCreatorLicenseSummary(existing.type),
      licensePeriodActive: ctx?.licensePeriodActive ?? false,
      activeStudioProfile: ctx?.activeProfile ?? null,
      requiresPayment: false,
    });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        /** New onboarding */
        package?: "UPLOAD_ONLY" | "PIPELINE";
        billing?: "YEARLY" | "MONTHLY";
        /** Legacy music / old UI */
        type?: string;
        promoCode?: string;
      }
    | null;

  let storedType: string;
  let periodEnd: Date | null;

  if (role === "MUSIC_CREATOR") {
    const legacy = body?.type;
    if (legacy === "PER_UPLOAD" || legacy === "PER_UPLOAD_R10" || legacy === "PER_UPLOAD_R24_99") {
      storedType = legacy === "PER_UPLOAD" ? "PER_UPLOAD_R24_99" : legacy;
      periodEnd = null;
    } else {
      storedType = "YEARLY_R89";
      periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }
  } else if (body?.package === "UPLOAD_ONLY") {
    storedType = CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY;
    periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  } else if (body?.package === "PIPELINE" && body.billing === "YEARLY") {
    storedType = CREATOR_LICENSE_TYPE.PIPELINE_YEARLY;
    periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  } else if (body?.package === "PIPELINE" && body.billing === "MONTHLY") {
    storedType = CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY;
    periodEnd = addMonths(new Date(), 1);
  } else {
    return NextResponse.json(
      {
        error:
          "Pipeline was not assigned: choose Upload & originals, or Full pipeline with yearly or monthly billing.",
        code: "INVALID_PLAN_SELECTION",
      },
      { status: 400 },
    );
  }

  let basePrice = 0;
  if (storedType === CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY) {
    basePrice = CREATOR_ONBOARDING_PLANS.UPLOAD_ONLY.price;
  } else if (storedType === CREATOR_LICENSE_TYPE.PIPELINE_YEARLY) {
    basePrice = CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price;
  } else if (storedType === CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY) {
    basePrice = CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price;
  } else if (storedType === "YEARLY_R89" || storedType === "YEARLY") {
    basePrice = CREATOR_LICENSE_CONFIG.YEARLY.price;
  } else if (storedType === "PER_UPLOAD_R24_99" || storedType === "PER_UPLOAD_R10" || storedType === "PER_UPLOAD") {
    basePrice = CREATOR_LICENSE_CONFIG.PER_UPLOAD.price;
  }

  let finalPrice = basePrice;
  let appliedPromo: { id: string; code: string } | null = null;
  const promoCode = typeof body?.promoCode === "string" ? body.promoCode.trim() : "";
  if (promoCode) {
    const promoResult = await resolvePromoCode(promoCode, "CREATOR_LICENSE");
    if ("error" in promoResult) {
      return NextResponse.json({ error: promoResult.error }, { status: 400 });
    }
    const alreadyUsed = await prisma.promoCodeRedemption.findUnique({
      where: {
        promoCodeId_userId_context: {
          promoCodeId: promoResult.promo.id,
          userId: user.id,
          context: "CREATOR_LICENSE",
        },
      },
      select: { id: true },
    });
    if (alreadyUsed) {
      return NextResponse.json({ error: "Promo code already used for this creator account." }, { status: 400 });
    }
    finalPrice = computeDiscountedAmount(basePrice, promoResult.promo);
    appliedPromo = { id: promoResult.promo.id, code: promoResult.promo.code };
  }

  await ensureCreatorStudioProfilesForUser(user.id);
  const preCtx = await loadStudioPipelineContext(user.id);
  const profileId = preCtx?.activeProfile?.id ?? null;

  let license;
  try {
    license = await prisma.creatorDistributionLicense.create({
      data: {
        userId: user.id,
        creatorStudioProfileId: profileId,
        type: storedType,
        yearlyExpiresAt: periodEnd,
        externalPaymentId: null,
      },
    });
  } catch (e) {
    if (isMissingCreatorStudioInfrastructure(e)) {
      license = await prisma.creatorDistributionLicense.create({
        data: {
          userId: user.id,
          type: storedType,
          yearlyExpiresAt: periodEnd,
          externalPaymentId: null,
        },
      });
    } else {
      throw e;
    }
  }

  const ctx = await loadStudioPipelineContext(user.id);
  if (appliedPromo) {
    const redemption = await redeemPromoCode({
      promoCodeId: appliedPromo.id,
      userId: user.id,
      context: "CREATOR_LICENSE",
      referenceId: license.id,
      discountAmount: Math.max(0, basePrice - finalPrice),
      resultingPlan: storedType,
      metadata: { basePrice, finalPrice, role },
    });
    if (!redemption.ok) {
      await prisma.creatorDistributionLicense.delete({ where: { id: license.id } });
      return NextResponse.json({ error: promoFailureMessage(redemption.reason) }, { status: 400 });
    }
  }

  return NextResponse.json({
    license,
    requiresPayment: false,
    pipelineAccess: ctx?.pipelineAccess ?? false,
    suiteAccess: ctx?.suiteAccess ?? defaultSuiteAccessOpen(),
    planSummary: formatCreatorLicenseSummary(license.type),
    licensePeriodActive: ctx?.licensePeriodActive ?? false,
    activeStudioProfile: ctx?.activeProfile ?? null,
    pricing: {
      basePrice,
      finalPrice,
      promoCode: appliedPromo?.code ?? null,
      discountAmount: Math.max(0, basePrice - finalPrice),
    },
    redirectTo: role === "MUSIC_CREATOR" ? "/music-creator/dashboard" : "/creator/command-center",
  });
}
