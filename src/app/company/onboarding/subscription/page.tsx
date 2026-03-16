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

export default async function CompanySubscriptionOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/signin");

  const role = (session.user as { role?: string })?.role;
  const companyRoles = ["CREW_TEAM", "CASTING_AGENCY", "LOCATION_OWNER", "EQUIPMENT_COMPANY", "CATERING_COMPANY"];
  if (!role || !companyRoles.includes(role)) redirect("/browse");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      companySubscriptions: {
        where: { companyType: role, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (user?.companySubscriptions?.[0]) redirect(COMPANY_DASHBOARDS[role] ?? "/browse");

  return (
    <div className="min-h-screen bg-[#0c1222] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Choose your listing plan</h1>
        <p className="text-slate-400 text-center mb-8">Subscribe to appear in creator dashboards and receive requests.</p>
        <CompanySubscriptionClient dashboardUrl={COMPANY_DASHBOARDS[role]} />
      </div>
    </div>
  );
}
