import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCreatorPackageStatus } from "@/lib/creator-package-gate";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { LicenseClient } from "./license-client";
import { OnboardingExitBar } from "@/components/auth/onboarding-exit-bar";

export default async function CreatorLicenseOnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect(signInUrlForDestination("/creator/onboarding/license"));
  if ((session.user as { role?: string })?.role !== "CONTENT_CREATOR") redirect("/creator/dashboard");

  const userId = (session.user as { id?: string }).id;
  if (userId) {
    const status = await getCreatorPackageStatus(userId, "CONTENT_CREATOR");
    if (status.complete) redirect("/creator/command-center");
  }

  return (
    <div className="min-h-screen bg-background px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-5xl">
        <OnboardingExitBar />
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-sm uppercase tracking-[0.28em] text-orange-300/80">Filmmaker onboarding</p>
          <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">Choose your creator plan</h1>
          <p className="mt-3 text-slate-300/78">
            Upload-only creators get distribution and analytics without the in-app pipeline. Upgrade path: full pipeline with yearly (best value) or monthly billing.
          </p>
        </div>

        <div className="mt-12">
        <LicenseClient />
        </div>
      </div>
    </div>
  );
}
