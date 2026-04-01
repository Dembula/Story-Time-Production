import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CompanySubscriptionClient } from "./subscription-client";

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
  if (!session?.user?.email) redirect("/auth/signin");

  const role = (session.user as { role?: string })?.role;
  const companyRoles = ["CREW_TEAM", "CASTING_AGENCY", "LOCATION_OWNER", "EQUIPMENT_COMPANY", "CATERING_COMPANY"];
  if (!role || !companyRoles.includes(role)) redirect("/browse");
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      companySubscriptions: {
        where: { companyType: role, status: "ACTIVE", currentPeriodEnd: { gt: now } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (user?.companySubscriptions?.[0]) redirect(COMPANY_DASHBOARDS[role] ?? "/browse");

  return (
    <div className="min-h-screen bg-background px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-sm uppercase tracking-[0.28em] text-orange-300/80">
            {COMPANY_LABELS[role] ?? "Company"} onboarding
          </p>
          <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">Choose your listing plan</h1>
          <p className="mt-3 text-slate-300/78">
            Match the same polished onboarding journey as viewer plans while choosing how prominently your company should appear to creators.
          </p>
        </div>

        <div className="mt-12">
        <CompanySubscriptionClient dashboardUrl={COMPANY_DASHBOARDS[role]} />
        </div>
      </div>
    </div>
  );
}
