import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LicenseClient } from "./license-client";

export default async function MusicLicenseOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/signin");
  if ((session.user as { role?: string })?.role !== "MUSIC_CREATOR") redirect("/music-creator/dashboard");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      creatorDistributionLicense: { select: { id: true } },
    },
  });
  if (user?.creatorDistributionLicense) redirect("/music-creator/dashboard");

  return (
    <div className="min-h-screen bg-background px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-sm uppercase tracking-[0.28em] text-orange-300/80">Music creator onboarding</p>
          <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">Choose your distribution option</h1>
          <p className="mt-3 text-slate-300/78">
            Launch with the same polished onboarding style as viewer plans, while choosing the music distribution payment model that fits your release cadence.
          </p>
        </div>

        <div className="mt-12">
        <LicenseClient />
        </div>
      </div>
    </div>
  );
}
