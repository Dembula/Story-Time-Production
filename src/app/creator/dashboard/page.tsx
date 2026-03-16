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
      include: { creatorDistributionLicense: true },
    });
    if (!user?.creatorDistributionLicense) redirect("/creator/onboarding/license");
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <CreatorProjectsDashboardClient />
      </div>
    </div>
  );
}
