import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PackageClient } from "./package-client";
import { getViewerModel, isViewerSubscriptionExpired } from "@/lib/viewer-access";

export default async function OnboardingPackagePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      viewerSubscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const sub = user?.viewerSubscriptions?.[0];
  const hasActive = sub && !isViewerSubscriptionExpired(sub);
  if (hasActive) redirect(getViewerModel(sub) === "PPV" ? "/browse" : "/profiles");

  return (
    <div className="min-h-screen bg-background px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-sm uppercase tracking-[0.28em] text-orange-300/80">Viewer onboarding</p>
          <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">Choose your viewer model</h1>
          <p className="mt-3 text-slate-300/78">
            Decide between full-catalogue subscription access or a single-profile PPV account before continuing.
          </p>
        </div>

        <div className="mt-12">
        <PackageClient />
        </div>
      </div>
    </div>
  );
}
