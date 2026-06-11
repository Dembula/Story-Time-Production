import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { CateringDashboardClient } from "./catering-dashboard-client";

export default async function CateringCompanyDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(signInUrlForDestination("/catering-company/dashboard"));
  const role = (session.user as { role?: string })?.role;
  if (role !== "CATERING_COMPANY" && role !== "ADMIN") {
    redirect(signInUrlForDestination("/catering-company/dashboard"));
  }
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      companySubscriptions: {
        where: { companyType: "CATERING_COMPANY", status: "ACTIVE", currentPeriodEnd: { gt: now } },
        take: 1,
      },
    },
  });
  if (!user?.companySubscriptions?.length) redirect("/company/onboarding/subscription");

  return <CateringDashboardClient />;
}
