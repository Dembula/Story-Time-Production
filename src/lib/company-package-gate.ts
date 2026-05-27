import { redirect } from "next/navigation";
import { hasCompletedPackagePaymentForPayoutKyc } from "@/lib/payout-kyc-eligibility";

const COMPANY_ROLES = new Set([
  "CREW_TEAM",
  "CASTING_AGENCY",
  "LOCATION_OWNER",
  "EQUIPMENT_COMPANY",
  "CATERING_COMPANY",
]);

export function isCompanyRole(role: string | null | undefined): boolean {
  return Boolean(role && COMPANY_ROLES.has(role));
}

export function isCompanyOnboardingExemptPath(pathname: string): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/company/onboarding") ||
    pathname.startsWith("/payments/")
  );
}

export function companyOnboardingPath(): string {
  return "/company/onboarding/subscription";
}

export async function requireCompanyPackageComplete(
  userId: string,
  role: string | null | undefined,
): Promise<void> {
  if (!role || !isCompanyRole(role)) return;
  const complete = await hasCompletedPackagePaymentForPayoutKyc(userId, role);
  if (!complete) {
    redirect(companyOnboardingPath());
  }
}
