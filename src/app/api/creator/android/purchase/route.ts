import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_LICENSE_TYPE,
  CREATOR_ONBOARDING_PLANS,
  CREATOR_PER_FILM_UPLOAD_PRICE,
  formatCreatorLicenseSummary,
} from "@/lib/pricing";
import { ensureCreatorStudioProfilesForUser, loadStudioPipelineContext } from "@/lib/creator-studio";
import { defaultSuiteAccessOpen } from "@/lib/creator-suite-access";
import { getCreatorPackageStatus } from "@/lib/creator-package-gate";
import { CREATOR_FILM_UPLOAD_PURPOSE } from "@/lib/creator-film-upload-payment";
import { isMissingCreatorStudioInfrastructure } from "@/lib/prisma-missing-table";
import { gateStoreFreeTrialForPlatform } from "@/lib/payments/free-trial-settings";
import { isCreatorTrialCardPending } from "@/lib/payments/creator-pipeline-trial";
import {
  detectGoogleStoreFreeTrial,
  storeTrialPaymentMeta,
} from "@/lib/payments/store-trial";
import { resolveGoogleCreatorProduct } from "@/lib/payments/apple-iap/products";
import { resolveGooglePlayPackageName } from "@/lib/payments/google-play/config";
import {
  acknowledgeGooglePlayProduct,
  acknowledgeGooglePlaySubscription,
  requireGooglePlayProductVerification,
  requireGooglePlaySubscriptionVerification,
} from "@/lib/payments/google-play/verify";
import { resolveGooglePlaySettlement } from "@/lib/payments/google-play/settlement";
import { bookGooglePlayLedgerIfCash } from "@/lib/payments/google-play/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

function resolveProduct(
  productId: string,
  packageHint?: string | null,
  billingHint?: string | null,
) {
  const mapped = resolveGoogleCreatorProduct(productId);
  if (mapped?.kind === "content_upload") {
    return { kind: "content_upload" as const, amount: CREATOR_PER_FILM_UPLOAD_PRICE };
  }
  if (mapped?.kind === "creator_license" && mapped.licenseType) {
    const isMonthly = mapped.billing === "MONTHLY";
    return {
      kind: "creator_license" as const,
      storedType: mapped.licenseType,
      periodEnd: isMonthly
        ? addMonths(new Date(), 1)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      amount:
        mapped.package === "UPLOAD_YEARLY"
          ? CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price
          : mapped.package === "PIPELINE_MONTHLY"
            ? CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price
            : CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price,
      package:
        mapped.package === "UPLOAD_YEARLY"
          ? "UPLOAD_YEARLY"
          : "PIPELINE",
      billing: mapped.billing ?? "YEARLY",
    };
  }
  // Legacy client hints
  if (packageHint === "UPLOAD_YEARLY") {
    return {
      kind: "creator_license" as const,
      storedType: CREATOR_LICENSE_TYPE.UPLOAD_ONLY_YEARLY,
      periodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      amount: CREATOR_ONBOARDING_PLANS.UPLOAD_YEARLY.price,
      package: "UPLOAD_YEARLY",
      billing: "YEARLY",
    };
  }
  if (packageHint === "PIPELINE" && billingHint === "MONTHLY") {
    return {
      kind: "creator_license" as const,
      storedType: CREATOR_LICENSE_TYPE.PIPELINE_MONTHLY,
      periodEnd: addMonths(new Date(), 1),
      amount: CREATOR_ONBOARDING_PLANS.PIPELINE_MONTHLY.price,
      package: "PIPELINE",
      billing: "MONTHLY",
    };
  }
  if (packageHint === "PIPELINE" && billingHint === "YEARLY") {
    return {
      kind: "creator_license" as const,
      storedType: CREATOR_LICENSE_TYPE.PIPELINE_YEARLY,
      periodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      amount: CREATOR_ONBOARDING_PLANS.PIPELINE_YEARLY.price,
      package: "PIPELINE",
      billing: "YEARLY",
    };
  }
  return null;
}

/** Body: productId, purchaseToken, orderId?, packageName?, kind, package?, billing?, contentId?, … */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    productId?: string;
    purchaseToken?: string;
    orderId?: string;
    packageName?: string;
    kind?: string;
    package?: string;
    billing?: string;
    contentId?: string;
    source?: string;
    isFreeTrial?: boolean;
    freeTrial?: boolean;
    offerId?: string;
    trialEndsAt?: string;
  } | null;

  const productId = body?.productId?.trim() ?? "";
  const purchaseToken = body?.purchaseToken?.trim() ?? "";
  const gatewayId = (body?.orderId?.trim() || purchaseToken).trim();
  if (!productId || !purchaseToken) {
    return NextResponse.json({ error: "productId and purchaseToken are required." }, { status: 400 });
  }

  const resolved = resolveProduct(productId, body?.package, body?.billing);
  if (!resolved) {
    return NextResponse.json({ error: "Unknown Play Store product." }, { status: 400 });
  }

  const kind = (body?.kind as "creator_license" | "content_upload" | undefined) ?? resolved.kind;
  const packageName = resolveGooglePlayPackageName(body?.packageName, "creators");

  try {
    if (kind === "content_upload") {
      await requireGooglePlayProductVerification({
        packageName,
        productId,
        purchaseToken,
      });
      void acknowledgeGooglePlayProduct({ packageName, productId, purchaseToken });
    } else {
      await requireGooglePlaySubscriptionVerification({
        packageName,
        purchaseToken,
        expectedProductId: productId,
      });
      void acknowledgeGooglePlaySubscription({ packageName, purchaseToken });
    }
  } catch (err) {
    const status =
      typeof (err as { status?: number })?.status === "number" ? (err as { status: number }).status : 502;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Google Play verification failed" },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }

  const existing = await prisma.paymentRecord.findFirst({
    where: {
      OR: [{ gatewayTransactionId: gatewayId }, { providerPaymentId: purchaseToken }],
      status: "SUCCEEDED",
    },
    select: { id: true },
  });
  if (existing) {
    if (kind === "content_upload" && body?.contentId) {
      const content = await prisma.content.findFirst({
        where: { id: body.contentId, creatorId: userId },
        select: { id: true, reviewStatus: true },
      });
      return NextResponse.json({
        ok: true,
        alreadyApplied: true,
        reviewStatus: content?.reviewStatus ?? null,
      });
    }
    const status = await getCreatorPackageStatus(userId, role);
    return NextResponse.json({ ok: true, alreadyApplied: true, packageComplete: status.complete });
  }

  try {
    if (kind === "content_upload") {
      const contentId = body?.contentId?.trim();
      if (!contentId) {
        return NextResponse.json({ error: "contentId is required for upload payment." }, { status: 400 });
      }
      const content = await prisma.content.findFirst({
        where: { id: contentId, creatorId: userId },
        select: { id: true, reviewStatus: true },
      });
      if (!content) {
        return NextResponse.json({ error: "Content not found." }, { status: 404 });
      }

      const settlement = await resolveGooglePlaySettlement({
        gross: resolved.amount,
        source: "play_billing",
      });
      const created = await prisma.paymentRecord.create({
        data: {
          userId,
          provider: "GOOGLE",
          purpose: CREATOR_FILM_UPLOAD_PURPOSE,
          status: "SUCCEEDED",
          amount: resolved.amount,
          currency: "ZAR",
          email: session.user.email ?? undefined,
          relatedEntityType: "Content",
          relatedEntityId: content.id,
          gatewayTransactionId: gatewayId,
          providerPaymentId: purchaseToken,
          settlementSource: settlement.settlementSource,
          settlementAmount: settlement.settlementAmount,
          providerFeeAmount: settlement.providerFeeAmount,
          paidAt: new Date(),
          metadata: {
            productId,
            packageName,
            source: body?.source ?? "android_app",
            googleVerified: true,
            ...settlement.metadataExtras,
          },
        },
      });
      await bookGooglePlayLedgerIfCash({
        id: created.id,
        amount: resolved.amount,
        settlementAmount: settlement.settlementAmount,
        purpose: CREATOR_FILM_UPLOAD_PURPOSE,
        relatedEntityType: "Content",
        relatedEntityId: content.id,
      });

      const updated = await prisma.content.update({
        where: { id: content.id },
        data: { reviewStatus: "PENDING", submittedAt: new Date() },
      });

      return NextResponse.json({
        ok: true,
        reviewStatus: updated.reviewStatus,
        contentId: updated.id,
      });
    }

    if (!("storedType" in resolved) || !resolved.storedType) {
      return NextResponse.json({ error: "Invalid license product." }, { status: 400 });
    }

    let license = await prisma.creatorDistributionLicense.findUnique({ where: { userId } });
    const trialRaw = detectGoogleStoreFreeTrial({
      productId,
      isFreeTrial: body?.isFreeTrial,
      freeTrial: body?.freeTrial,
      offerId: body?.offerId,
      trialEndsAt: body?.trialEndsAt,
    });
    const trial = await gateStoreFreeTrialForPlatform(trialRaw, {
      continuingPending: isCreatorTrialCardPending(license),
    });
    const isFreeTrial = trial.isFreeTrial;
    const trialEndsAt = isFreeTrial ? trial.trialEndsAt : null;
    const amount = isFreeTrial ? 0 : resolved.amount;
    const periodEnd =
      isFreeTrial && trialEndsAt ? trialEndsAt : (resolved.periodEnd ?? null);

    await ensureCreatorStudioProfilesForUser(userId);
    let profileId: string | null = null;
    try {
      const preCtx = await loadStudioPipelineContext(userId);
      profileId = preCtx?.activeProfile?.id ?? null;
    } catch {
      profileId = null;
    }

    const licenseData = {
      type: resolved.storedType,
      yearlyExpiresAt: periodEnd,
      trialEndsAt,
      autoRenew: true,
      status: isFreeTrial ? "TRIAL_ACTIVE" : "ACTIVE",
      lastPaymentAt: new Date(),
      lastPaymentStatus: isFreeTrial ? "TRIAL" : "SUCCEEDED",
      externalPaymentId: gatewayId,
      pastDueSince: null as Date | null,
    };

    if (!license) {
      try {
        license = await prisma.creatorDistributionLicense.create({
          data: {
            userId,
            creatorStudioProfileId: profileId,
            ...licenseData,
          },
        });
      } catch (e) {
        if (isMissingCreatorStudioInfrastructure(e)) {
          license = await prisma.creatorDistributionLicense.create({
            data: {
              userId,
              ...licenseData,
            },
          });
        } else {
          throw e;
        }
      }
    } else {
      license = await prisma.creatorDistributionLicense.update({
        where: { id: license.id },
        data: licenseData,
      });
    }

    const settlement = isFreeTrial
      ? {
          providerFeeAmount: 0,
          settlementAmount: 0,
          settlementSource: "free_trial" as const,
          metadataExtras: {},
        }
      : await resolveGooglePlaySettlement({ gross: amount, source: "play_billing" });

    const created = await prisma.paymentRecord.create({
      data: {
        userId,
        provider: "GOOGLE",
        purpose: "creator_distribution_license_google_play",
        status: "SUCCEEDED",
        amount,
        currency: "ZAR",
        email: session.user.email ?? undefined,
        relatedEntityType: "CreatorDistributionLicense",
        relatedEntityId: license.id,
        gatewayTransactionId: gatewayId,
        providerPaymentId: purchaseToken,
        settlementSource: isFreeTrial ? "free_trial" : settlement.settlementSource,
        settlementAmount: isFreeTrial ? 0 : settlement.settlementAmount,
        providerFeeAmount: isFreeTrial ? 0 : settlement.providerFeeAmount,
        paidAt: new Date(),
        metadata: {
          productId,
          package: resolved.package,
          billing: resolved.billing,
          packageName,
          source: body?.source ?? "android_app",
          listPriceZar: resolved.amount,
          googleVerified: true,
          ...storeTrialPaymentMeta(trial),
          ...settlement.metadataExtras,
        },
      },
    });

    if (!isFreeTrial && amount > 0) {
      await bookGooglePlayLedgerIfCash({
        id: created.id,
        amount,
        settlementAmount: settlement.settlementAmount,
        purpose: "creator_distribution_license_google_play",
        relatedEntityType: "CreatorDistributionLicense",
        relatedEntityId: license.id,
      });
    }

    const packageStatus = await getCreatorPackageStatus(userId, role);
    let ctx = null;
    try {
      ctx = await loadStudioPipelineContext(userId);
    } catch {
      ctx = null;
    }

    return NextResponse.json({
      ok: true,
      packageComplete: packageStatus.complete,
      planSummary: formatCreatorLicenseSummary(license.type),
      pipelineAccess: ctx?.pipelineAccess ?? false,
      suiteAccess: ctx?.suiteAccess ?? defaultSuiteAccessOpen(),
      licensePeriodActive: ctx?.licensePeriodActive ?? false,
      isFreeTrial,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      status: license.status,
    });
  } catch (error) {
    console.error("android/purchase failed", error);
    const message = error instanceof Error ? error.message : "Purchase recording failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
