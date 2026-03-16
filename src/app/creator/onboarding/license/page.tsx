import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LicenseClient } from "./license-client";

export default async function CreatorLicenseOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/signin");
  if ((session.user as { role?: string })?.role !== "CONTENT_CREATOR") redirect("/creator/dashboard");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { creatorDistributionLicense: true },
  });
  if (user?.creatorDistributionLicense) redirect("/creator/dashboard");

  return (
    <div className="min-h-screen bg-[#0c1222] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <h1 className="text-2xl font-bold text-white text-center mb-2">Choose distribution option</h1>
        <p className="text-slate-400 text-center mb-8">Pay once to unlock uploads</p>
        <LicenseClient />
      </div>
    </div>
  );
}
