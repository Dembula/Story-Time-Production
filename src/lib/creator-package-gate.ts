import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isCreatorLicensePeriodActive, isCreatorPerFilmLicense } from "@/lib/pricing";

export type CreatorPackageGateReason = "no_license" | "payment_required" | "expired";

export type CreatorPackageStatus = {
  complete: boolean;
  reason?: CreatorPackageGateReason;
  onboardingPath: string;
  licenseId?: string;
  licenseType?: string;
};

export function creatorOnboardingPathForRole(role: string | null | undefined): string {
  return role === "MUSIC_CREATOR" ? "/music-creator/onboarding/license" : "/creator/onboarding/license";
}

export function isCreatorOnboardingExemptPath(pathname: string, role?: string | null): boolean {
  if (!pathname) return false;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/creator/join")) return true;
  if (role === "MUSIC_CREATOR") {
    return pathname.startsWith("/music-creator/onboarding");
  }
  if (role === "CONTENT_CREATOR") {
    return (
      pathname.startsWith("/creator/onboarding") ||
      pathname.startsWith("/payments/")
    );
  }
  return pathname.startsWith("/creator/onboarding") || pathname.startsWith("/music-creator/onboarding");
}

export function creatorLicenseNeedsUpfrontPayment(type: string): boolean {
  return !isCreatorPerFilmLicense(type);
}

/** Whether the creator has selected a plan and satisfied payment (or valid per-upload terms). */
export async function getCreatorPackageStatus(
  userId: string,
  role?: string | null,
): Promise<CreatorPackageStatus> {
  const onboardingPath = creatorOnboardingPathForRole(role);

  const license = await prisma.creatorDistributionLicense.findUnique({
    where: { userId },
    select: { id: true, type: true, yearlyExpiresAt: true, status: true },
  });

  if (!license) {
    return { complete: false, reason: "no_license", onboardingPath };
  }

  if (!isCreatorLicensePeriodActive(license)) {
    // Persist expiry so dashboards / renewals don't keep treating the row as active.
    if (license.status === "ACTIVE" && license.yearlyExpiresAt && new Date(license.yearlyExpiresAt).getTime() <= Date.now()) {
      await prisma.creatorDistributionLicense.update({
        where: { id: license.id },
        data: { status: "PAST_DUE", autoRenew: false, lastPaymentError: "Package period ended. Choose a plan to continue." },
      }).catch(() => {});
    }
    return {
      complete: false,
      reason: "expired",
      onboardingPath,
      licenseId: license.id,
      licenseType: license.type,
    };
  }

  if (isCreatorPerFilmLicense(license.type)) {
    return {
      complete: true,
      onboardingPath,
      licenseId: license.id,
      licenseType: license.type,
    };
  }

  const paid = await prisma.paymentRecord.findFirst({
    where: {
      relatedEntityType: "CreatorDistributionLicense",
      relatedEntityId: license.id,
      status: "SUCCEEDED",
    },
    select: { id: true },
  });

  const promoRedemption = await prisma.promoCodeRedemption.findFirst({
    where: {
      userId,
      context: "CREATOR_LICENSE",
      referenceId: license.id,
    },
    select: { id: true },
  });

  if (!paid && !promoRedemption) {
    return {
      complete: false,
      reason: "payment_required",
      onboardingPath,
      licenseId: license.id,
      licenseType: license.type,
    };
  }

  return {
    complete: true,
    onboardingPath,
    licenseId: license.id,
    licenseType: license.type,
  };
}

export async function requireCreatorPackageComplete(
  userId: string,
  role?: string | null,
): Promise<void> {
  const status = await getCreatorPackageStatus(userId, role);
  if (!status.complete) {
    redirect(status.onboardingPath);
  }
}
