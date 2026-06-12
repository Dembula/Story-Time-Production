import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isViewerAccountOnboardingComplete } from "@/lib/viewer-account-onboarding";
import { getLatestViewerSubscription, subscriptionPaymentRequired } from "@/lib/viewer-access";
import { AccountSetupClient } from "./account-setup-client";

export default async function AccountSetupPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const role = (session.user as { role?: string }).role;
  if (role !== "SUBSCRIBER" && role !== "ADMIN") redirect("/browse");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, phoneNumber: true, accountOnboardingCompletedAt: true },
  });
  if (user && isViewerAccountOnboardingComplete(user)) redirect("/profiles");

  const subscription = await getLatestViewerSubscription(session.user.id);
  if (subscription && subscriptionPaymentRequired(subscription)) {
    redirect("/profiles?payment=required");
  }

  const allowAccountDeferral = !subscription || !subscriptionPaymentRequired(subscription);

  return (
    <div className="min-h-screen bg-background px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <AccountSetupClient allowAccountDeferral={allowAccountDeferral} />
      </div>
    </div>
  );
}
