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
    <div className="min-h-screen bg-background px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-sm uppercase tracking-[0.28em] text-orange-300/80">Filmmaker onboarding</p>
          <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">Choose your distribution option</h1>
          <p className="mt-3 text-slate-300/78">
            Set up a professional release workflow now, either with yearly billing upfront or payment only when you submit each title for review.
          </p>
        </div>

        <div className="mt-12">
        <LicenseClient />
        </div>
      </div>
    </div>
  );
}
