import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreatorProjectsDashboardClient } from "./creator-projects-dashboard-client";

export default async function CreatorDashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) redirect("/auth/signin");

  if (role === "CONTENT_CREATOR" && session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        creatorDistributionLicense: { select: { id: true } },
      },
    });
    if (!user?.creatorDistributionLicense) redirect("/creator/onboarding/license");
  }

  return (
    <div className="px-6 py-8 md:px-12 md:py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        <CreatorProjectsDashboardClient />
      </div>
    </div>
  );
}
