import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CastingDashboardClient } from "./casting-dashboard-client";

export default async function CastingAgencyDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/signin");
  const role = (session.user as { role?: string })?.role;
  if (role !== "CASTING_AGENCY" && role !== "ADMIN") redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { companySubscriptions: { where: { companyType: "CASTING_AGENCY", status: "ACTIVE" }, take: 1 } },
  });
  if (!user?.companySubscriptions?.length) redirect("/company/onboarding/subscription");

  return <CastingDashboardClient />;
}
