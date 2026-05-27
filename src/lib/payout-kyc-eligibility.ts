import { prisma } from "@/lib/prisma";
import { isCreatorPerUploadLicense, isCreatorLicensePeriodActive } from "@/lib/pricing";
import { PAYOUT_KYC_ROLES, requiresPayoutKyc } from "@/lib/payout-kyc";

const COMPANY_ROLES = new Set([
  "CREW_TEAM",
  "CASTING_AGENCY",
  "LOCATION_OWNER",
  "EQUIPMENT_COMPANY",
  "CATERING_COMPANY",
]);

const CREATOR_ROLES = new Set(["CONTENT_CREATOR", "MUSIC_CREATOR"]);

async function creatorDistributionPackagePaid(userId: string): Promise<boolean> {
  const license = await prisma.creatorDistributionLicense.findUnique({
    where: { userId },
    select: { id: true, type: true, yearlyExpiresAt: true },
  });
  if (!license) return false;

  if (isCreatorPerUploadLicense(license.type)) {
    return isCreatorLicensePeriodActive(license);
  }

  const paid = await prisma.paymentRecord.findFirst({
    where: {
      relatedEntityType: "CreatorDistributionLicense",
      relatedEntityId: license.id,
      status: "SUCCEEDED",
    },
    select: { id: true },
  });
  return Boolean(paid);
}

async function companyListingPackagePaid(userId: string, role: string): Promise<boolean> {
  const now = new Date();
  const sub = await prisma.companySubscription.findFirst({
    where: {
      userId,
      companyType: role,
      status: "ACTIVE",
      currentPeriodEnd: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      lastPaymentStatus: true,
      externalPaymentId: true,
    },
  });
  if (!sub) return false;

  if (sub.lastPaymentStatus === "SUCCEEDED" || sub.externalPaymentId) {
    return true;
  }

  const paid = await prisma.paymentRecord.findFirst({
    where: {
      relatedEntityType: "CompanySubscription",
      relatedEntityId: sub.id,
      status: "SUCCEEDED",
    },
    select: { id: true },
  });
  return Boolean(paid);
}

/** True when the user has chosen a package and completed payment (or equivalent) for their role. */
export async function hasCompletedPackagePaymentForPayoutKyc(
  userId: string,
  role?: string | null,
): Promise<boolean> {
  if (!role || !requiresPayoutKyc(role)) return false;

  if (CREATOR_ROLES.has(role)) {
    return creatorDistributionPackagePaid(userId);
  }
  if (COMPANY_ROLES.has(role)) {
    return companyListingPackagePaid(userId, role);
  }
  return false;
}

/** Dashboard / workspace routes where the post-checkout KYC reminder may appear. */
export function isPayoutKycDashboardPath(pathname: string, role?: string | null): boolean {
  if (!pathname || !role || !PAYOUT_KYC_ROLES.has(role)) return false;

  const blocked =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/payout-verification") ||
    pathname.startsWith("/company/onboarding") ||
    pathname.startsWith("/creator/onboarding") ||
    pathname.startsWith("/music-creator/onboarding") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/payments/") ||
    pathname === "/" ||
    pathname.startsWith("/browse");

  if (blocked) return false;

  switch (role) {
    case "CONTENT_CREATOR":
      return pathname.startsWith("/creator/");
    case "MUSIC_CREATOR":
      return pathname.startsWith("/music-creator/");
    case "EQUIPMENT_COMPANY":
      return pathname.startsWith("/equipment-company/");
    case "LOCATION_OWNER":
      return pathname.startsWith("/location-owner/");
    case "CREW_TEAM":
      return pathname.startsWith("/crew-team/");
    case "CASTING_AGENCY":
      return pathname.startsWith("/casting-agency/");
    case "CATERING_COMPANY":
      return pathname.startsWith("/catering-company/");
    default:
      return false;
  }
}

export async function shouldShowPayoutKycPrompt(
  userId: string,
  role: string | null | undefined,
  pathname: string,
): Promise<boolean> {
  if (!role || !requiresPayoutKyc(role)) return false;
  if (!isPayoutKycDashboardPath(pathname, role)) return false;
  return hasCompletedPackagePaymentForPayoutKyc(userId, role);
}
