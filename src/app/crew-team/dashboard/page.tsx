import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { CrewTeamDashboardClient } from "./crew-team-dashboard-client";

export default async function CrewTeamDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(signInUrlForDestination("/crew-team/dashboard"));
  if ((session.user as { role?: string })?.role !== "CREW_TEAM" && (session.user as { role?: string })?.role !== "ADMIN") {
    redirect(signInUrlForDestination("/crew-team/dashboard"));
  }
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      companySubscriptions: {
        where: { companyType: "CREW_TEAM", status: "ACTIVE", currentPeriodEnd: { gt: now } },
        take: 1,
      },
    },
  });
  if (!user?.companySubscriptions?.length) redirect("/company/onboarding/subscription");

  return <CrewTeamDashboardClient />;
}
