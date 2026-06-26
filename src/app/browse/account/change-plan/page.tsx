import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChangePlanPicker } from "@/components/viewer/change-plan-picker";
import {
  getLatestViewerSubscription,
  isExpiredTrialSubscription,
  subscriptionNeedsReactivation,
} from "@/lib/viewer-access";

export default async function ChangePlanPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/auth/signin");

  const subscription = await getLatestViewerSubscription(user.id);
  if (!subscription) redirect("/onboarding/package");

  const reactivationMode =
    subscriptionNeedsReactivation(subscription) || isExpiredTrialSubscription(subscription);

  return (
    <div className="min-h-screen pt-24 pb-20 px-6">
      <div className="mx-auto max-w-3xl">
        <p className="mb-3 text-sm uppercase tracking-[0.28em] text-orange-300/80">
          {reactivationMode ? "Resume access" : "Subscription"}
        </p>
        <h1 className="text-3xl font-semibold text-white md:text-4xl">
          {reactivationMode ? "Choose your plan" : "Change plan"}
        </h1>
        <p className="mt-3 text-slate-400">
          {reactivationMode
            ? "Pick a viewer model and package, then pay securely without leaving Story Time."
            : "Upgrade or switch packages here. Mid-cycle upgrades only charge the price difference until your next renewal."}
        </p>

        <div className="mt-8">
          <ChangePlanPicker
            reactivationMode={reactivationMode}
            subscription={{
              plan: subscription.plan,
              viewerModel: subscription.viewerModel ?? "SUBSCRIPTION",
              status: subscription.status,
              trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            }}
          />
        </div>
      </div>
    </div>
  );
}
