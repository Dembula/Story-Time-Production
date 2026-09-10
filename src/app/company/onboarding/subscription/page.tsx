import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CompanySubscriptionClient } from "./subscription-client";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { OnboardingExitBar } from "@/components/auth/onboarding-exit-bar";
import { hasCompletedPackagePaymentForPayoutKyc } from "@/lib/payout-kyc-eligibility";

const COMPANY_DASHBOARDS: Record<string, string> = {
  CREW_TEAM: "/crew-team/dashboard",
  CASTING_AGENCY: "/casting-agency/dashboard",
  LOCATION_OWNER: "/location-owner/dashboard",
  EQUIPMENT_COMPANY: "/equipment-company/dashboard",
  CATERING_COMPANY: "/catering-company/dashboard",
};

const COMPANY_LABELS: Record<string, string> = {
  CREW_TEAM: "Crew team",
  CASTING_AGENCY: "Casting agency",
  LOCATION_OWNER: "Location company",
  EQUIPMENT_COMPANY: "Equipment company",
  CATERING_COMPANY: "Catering company",
};

export default async function CompanySubscriptionOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(signInUrlForDestination("/company/onboarding/subscription"));

  const role = (session.user as { role?: string })?.role;
  const userId = session.user.id;
  const companyRoles = ["CREW_TEAM", "CASTING_AGENCY", "LOCATION_OWNER", "EQUIPMENT_COMPANY", "CATERING_COMPANY"];
  if (!role || !companyRoles.includes(role)) redirect("/browse");

  // Match package-gate: only leave onboarding when payment is actually complete
  // (ACTIVE-but-unpaid must not bounce dashboard ↔ onboarding).
  if (userId && (await hasCompletedPackagePaymentForPayoutKyc(userId, role))) {
    redirect(COMPANY_DASHBOARDS[role] ?? "/browse");
  }

  return (
    <div className="min-h-screen bg-background px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-5xl">
        <OnboardingExitBar />
        <p className="mb-2 text-sm text-slate-400">{COMPANY_LABELS[role] ?? "Company"} package</p>
        <CompanySubscriptionClient dashboardUrl={COMPANY_DASHBOARDS[role] ?? "/browse"} />
      </div>
    </div>
  );
}
