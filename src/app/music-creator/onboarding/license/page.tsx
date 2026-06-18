import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCreatorPackageStatus } from "@/lib/creator-package-gate";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { LicenseClient } from "./license-client";
import { OnboardingExitBar } from "@/components/auth/onboarding-exit-bar";

export default async function MusicLicenseOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(signInUrlForDestination("/music-creator/onboarding/license"));
  if ((session.user as { role?: string })?.role !== "MUSIC_CREATOR") redirect("/music-creator/dashboard");

  const userId = (session.user as { id?: string }).id;
  if (userId) {
    const status = await getCreatorPackageStatus(userId, "MUSIC_CREATOR");
    if (status.complete) redirect("/music-creator/dashboard");
  }

  return (
    <div className="min-h-screen bg-background px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-5xl">
        <OnboardingExitBar />
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
