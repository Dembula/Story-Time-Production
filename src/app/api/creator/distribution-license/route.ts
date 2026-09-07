import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureCreatorStudioProfilesForUser, loadStudioPipelineContext } from "@/lib/creator-studio";
import { defaultSuiteAccessOpen } from "@/lib/creator-suite-access";
import { isMissingCreatorStudioInfrastructure } from "@/lib/prisma-missing-table";
import { getCreatorPackageStatus } from "@/lib/creator-package-gate";
import { CREATOR_LICENSE_CONFIG, CREATOR_LICENSE_TYPE, CREATOR_ONBOARDING_PLANS, formatCreatorLicenseSummary, isCreatorPerFilmLicense } from "@/lib/pricing";
import {
  computeDiscountedAmount,
  isFullyCompedCreatorLicenseRedemption,
  isFullyCompedPromo,
  promoGrantPeriodEnd,
  redeemPromoCode,
  resolvePromoCode,
  resolveUnusedPromoCode,
} from "@/lib/promo-codes";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";

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

function creatorLicenseNeedsUpfrontPayment(type: string) {
  return !isCreatorPerFilmLicense(type);
}

function resolveCreatorLicensePrice(type: string) {
  if (type === CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY) return CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price;
  if (type === "CREATOR_UPLOAD_ONLY_R99_Y") return CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price;
  if (type === CREATOR_LICENSE_TYPE.PIPELINE_YEARLY) return CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price;
  if (type === CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY) return CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price;
  if (type === CREATOR_LICENSE_TYPE.PER_FILM) return 0;
  if (type === "YEARLY_R89" || type === "YEARLY") return CREATOR_LICENSE_CONFIG.YEARLY.price;
  if (type === "PER_UPLOAD_R24_99" || type === "PER_UPLOAD_R10" || type === "PER_UPLOAD") return 0;
  return 0;
}

function creatorPostPaymentRedirect(role: string | undefined) {
  return role === "MUSIC_CREATOR" ? "/music-creator/dashboard" : "/creator/dashboard";
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
  const packageStatus = await getCreatorPackageStatus(userId, role);
  return NextResponse.json({
    license,
    pipelineAccess: ctx?.pipelineAccess ?? false,
    suiteAccess: ctx?.suiteAccess ?? defaultSuiteAccessOpen(),
    planSummary: license ? formatCreatorLicenseSummary(license.type) : null,
    licensePeriodActive: ctx?.licensePeriodActive ?? false,
    activeStudioProfile: ctx?.activeProfile ?? null,
    packageComplete: packageStatus.complete,
    packageGateReason: packageStatus.reason ?? null,
    onboardingPath: packageStatus.onboardingPath,
    requiresPayment: packageStatus.reason === "payment_required",
  });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as { id?: string }).id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const role = (session.user as { role?: string })?.role;
    if (!user || (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json().catch(() => null)) as
    | {
        /** New onboarding */
        package?: "PER_FILM" | "UPLOAD_YEARLY" | "UPLOAD_ONLY" | "PIPELINE";
        billing?: "YEARLY" | "MONTHLY";
        /** Legacy music / old UI */
        type?: string;
        promoCode?: string;
        /** Change / renew an existing package (same shape as onboarding). */
        action?: "change_plan" | "renew";
      }
    | null;

    const existing = await prisma.creatorDistributionLicense.findUnique({ where: { userId: user.id } });
    const isChangePlan = body?.action === "change_plan" || body?.action === "renew";
    const hasPlanSelection = Boolean(
      body?.package ||
        body?.type ||
        (typeof body?.promoCode === "string" && body.promoCode.trim()),
    );
    let forceUpdateExisting = false;

    if (existing && !isChangePlan) {
      const needsPayment = creatorLicenseNeedsUpfrontPayment(existing.type);
      let entitled = !needsPayment;
      if (needsPayment) {
        const paid = Boolean(
          await prisma.paymentRecord.findFirst({
            where: {
              relatedEntityType: "CreatorDistributionLicense",
              relatedEntityId: existing.id,
              status: "SUCCEEDED",
            },
            select: { id: true },
          }),
        );
        if (paid) {
          entitled = true;
        } else {
          const promoRows = await prisma.promoCodeRedemption.findMany({
            where: { userId: user.id, context: "CREATOR_LICENSE", referenceId: existing.id },
            select: { discountAmount: true, metadata: true },
          });
          entitled = promoRows.some((r) =>
            isFullyCompedCreatorLicenseRedemption(r.metadata, r.discountAmount),
          );
        }
      }

      if (entitled) {
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

      // Unpaid / incomplete: if the client sent a plan or promo, fall through so promo + pay works.
      if (hasPlanSelection) {
        forceUpdateExisting = true;
      } else {
        let checkoutUrl: string | null = null;
        const amount = resolveCreatorLicensePrice(existing.type);
        if (amount > 0) {
          try {
            checkoutUrl = (
              await initializeCheckout({
                userId: user.id,
                email: user.email,
                customerName: user.name,
                amount,
                purpose: "creator_distribution_license",
                referenceType: "CreatorDistributionLicense",
                referenceId: existing.id,
                returnUrl: buildPaymentReturnUrl(
                  creatorPostPaymentRedirect(role),
                  "creator_distribution_license",
                ),
                metadata: { storedType: existing.type, role, tokenize: true },
              })
            ).checkout.checkoutUrl;
          } catch (error) {
            return NextResponse.json({
              license: existing,
              requiresPayment: true,
              checkoutUrl: null,
              checkoutWarning: error instanceof Error ? error.message : "Unable to initialize checkout.",
              redirectTo: creatorPostPaymentRedirect(role),
            });
          }
        }
        return NextResponse.json({
          license: existing,
          requiresPayment: amount > 0,
          checkoutUrl,
          redirectTo: creatorPostPaymentRedirect(role),
        });
      }
    }

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
  } else if (body?.package === "PER_FILM") {
    storedType = CREATOR_LICENSE_TYPE.PER_FILM;
    periodEnd = null;
  } else if (body?.package === "UPLOAD_YEARLY" || body?.package === "UPLOAD_ONLY") {
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
          "Choose Pay per film, Catalogue unlimited (yearly), or Full pipeline with yearly or monthly billing.",
        code: "INVALID_PLAN_SELECTION",
      },
      { status: 400 },
    );
  }

  let basePrice = 0;
  basePrice = resolveCreatorLicensePrice(storedType);

  let finalPrice = basePrice;
  let appliedPromo: { id: string; code: string; kind: string; amount: number | null } | null = null;
  let skipPromoRedeem = false;
  const promoCode = typeof body?.promoCode === "string" ? body.promoCode.trim() : "";
  if (promoCode) {
    const unused = await resolveUnusedPromoCode(promoCode, user.id, "CREATOR_LICENSE");
    if (!("error" in unused)) {
      finalPrice = computeDiscountedAmount(basePrice, unused.promo);
      appliedPromo = {
        id: unused.promo.id,
        code: unused.promo.code,
        kind: unused.promo.kind,
        amount: unused.promo.amount ?? null,
      };
    } else {
      // Allow reuse when a prior attempt burned the code without settling payment (partial unlock bug).
      const resolved = await resolvePromoCode(promoCode, "CREATOR_LICENSE");
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      const prior = await prisma.promoCodeRedemption.findUnique({
        where: {
          promoCodeId_userId_context: {
            promoCodeId: resolved.promo.id,
            userId: user.id,
            context: "CREATOR_LICENSE",
          },
        },
        select: { discountAmount: true, metadata: true, referenceId: true },
      });
      if (!prior) {
        return NextResponse.json({ error: unused.error }, { status: 400 });
      }
      if (isFullyCompedCreatorLicenseRedemption(prior.metadata, prior.discountAmount)) {
        return NextResponse.json(
          { error: "Promo code already used for this creator account." },
          { status: 400 },
        );
      }
      finalPrice = computeDiscountedAmount(basePrice, resolved.promo);
      appliedPromo = {
        id: resolved.promo.id,
        code: resolved.promo.code,
        kind: resolved.promo.kind,
        amount: resolved.promo.amount ?? null,
      };
      skipPromoRedeem = true;
    }
    if (appliedPromo && isFullyCompedPromo(appliedPromo) && periodEnd) {
      periodEnd = promoGrantPeriodEnd(new Date(), appliedPromo, "year");
    }
  }

  const promoFreeGrant = finalPrice <= 0 && Boolean(appliedPromo);
  // Promo-funded periods do not auto-charge when they end — creator must re-subscribe.
  const autoRenew = !promoFreeGrant && finalPrice > 0;

    await ensureCreatorStudioProfilesForUser(user.id);
    let profileId: string | null = null;
    try {
      const preCtx = await loadStudioPipelineContext(user.id);
      profileId = preCtx?.activeProfile?.id ?? null;
    } catch {
      // Profile linkage should not block checkout initialization.
      profileId = null;
    }

  const licenseData = {
    creatorStudioProfileId: profileId,
    type: storedType,
    yearlyExpiresAt: periodEnd,
    autoRenew,
    cancelAtPeriodEnd: false,
    status: finalPrice > 0 ? "PAST_DUE" : "ACTIVE",
    externalPaymentId: null as string | null,
    lastPaymentError: null as string | null,
    renewalAttemptCount: 0,
    pastDueSince: null as Date | null,
  };

  let license;
  if (existing && (isChangePlan || forceUpdateExisting)) {
    license = await prisma.creatorDistributionLicense.update({
      where: { id: existing.id },
      data: licenseData,
    });
  } else {
    try {
      license = await prisma.creatorDistributionLicense.create({
        data: {
          userId: user.id,
          ...licenseData,
        },
      });
    } catch (e) {
      if (isMissingCreatorStudioInfrastructure(e)) {
        license = await prisma.creatorDistributionLicense.create({
          data: {
            userId: user.id,
            type: storedType,
            yearlyExpiresAt: periodEnd,
            autoRenew,
            status: finalPrice > 0 ? "PAST_DUE" : "ACTIVE",
            externalPaymentId: null,
          },
        });
      } else {
        throw e;
      }
    }
  }

  // Only burn / unlock via promo redemption when fully comped. Partial discounts redeem after PayFast success.
  if (appliedPromo && promoFreeGrant && !skipPromoRedeem) {
    const redemption = await redeemPromoCode({
      promoCodeId: appliedPromo.id,
      userId: user.id,
      context: "CREATOR_LICENSE",
      referenceId: license.id,
      discountAmount: Math.max(0, basePrice - finalPrice),
      resultingPlan: storedType,
      metadata: {
        basePrice,
        finalPrice,
        role,
        fundingSource: "promo",
        promoFreeGrant: true,
        periodEndsAt: periodEnd?.toISOString() ?? null,
      },
    });
    if (!redemption.ok) {
      if (!existing) {
        await prisma.creatorDistributionLicense.delete({ where: { id: license.id } });
      }
      return NextResponse.json({ error: promoFailureMessage(redemption.reason) }, { status: 400 });
    }
  }
  let checkoutUrl: string | null = null;
  if (finalPrice > 0) {
    try {
      checkoutUrl = (
        await initializeCheckout({
          userId: user.id,
          email: user.email,
          customerName: user.name,
          amount: finalPrice,
          purpose: "creator_distribution_license",
          referenceType: "CreatorDistributionLicense",
          referenceId: license.id,
          returnUrl: buildPaymentReturnUrl(
            creatorPostPaymentRedirect(role),
            "creator_distribution_license",
          ),
          metadata: {
            storedType,
            role,
            tokenize: true,
            ...(appliedPromo
              ? {
                  promoCode: appliedPromo.code,
                  promoCodeId: appliedPromo.id,
                  fundingSource: "partial_promo",
                  promoFreeGrant: false,
                  basePrice,
                  finalPriceAfterPromo: finalPrice,
                  discountAmount: Math.max(0, basePrice - finalPrice),
                }
              : {}),
          },
        })
      ).checkout.checkoutUrl;
    } catch (error) {
      return NextResponse.json({
        license,
        requiresPayment: true,
        checkoutUrl: null,
        checkoutWarning: error instanceof Error ? error.message : "Unable to initialize checkout.",
        redirectTo: creatorPostPaymentRedirect(role),
      });
    }
  }

    if (finalPrice > 0) {
      return NextResponse.json({
        license,
        requiresPayment: true,
        pricing: {
          basePrice,
          finalPrice,
          promoCode: appliedPromo?.code ?? null,
          discountAmount: Math.max(0, basePrice - finalPrice),
        },
        checkoutUrl,
        redirectTo: creatorPostPaymentRedirect(role),
      });
    }

    let ctx = null;
    try {
      ctx = await loadStudioPipelineContext(user.id);
    } catch {
      ctx = null;
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
      checkoutUrl,
      redirectTo: creatorPostPaymentRedirect(role),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creator onboarding failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
