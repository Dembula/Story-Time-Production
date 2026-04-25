import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MusicDashboardClient } from "./music-dashboard-client";
import { prisma } from "@/lib/prisma";

export default async function MusicCreatorDashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "MUSIC_CREATOR" && role !== "ADMIN")) redirect("/auth/signin");

  if (role === "MUSIC_CREATOR" && session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        creatorDistributionLicense: { select: { id: true } },
      },
    });
    if (!user?.creatorDistributionLicense) redirect("/music-creator/onboarding/license");
  }

  return <MusicDashboardClient />;
}
