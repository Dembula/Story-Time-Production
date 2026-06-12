import { Navbar } from "@/components/layout/navbar";
import { BrowseMobileNav } from "@/components/layout/browse-mobile-nav";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SubscriptionExpiredModal } from "./subscription-expired-modal";
import { ViewerSuggestionsTrigger } from "./viewer-suggestions-trigger";
import { cookies } from "next/headers";
import { getLatestViewerSubscription, getViewerModel, isViewerSubscriptionExpired, subscriptionPaymentRequired } from "@/lib/viewer-access";
import { isViewerAccountOnboardingComplete } from "@/lib/viewer-account-onboarding";
import { isViewerProfilePinUnlocked } from "@/lib/viewer-profile-access";

export default async function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  let subscriptionExpired = false;

  if (session?.user?.email && role === "SUBSCRIBER") {
    try {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          accountOnboardingCompletedAt: true,
        },
      });
      const sub = user?.id ? await getLatestViewerSubscription(user.id) : null;
      if (!sub) {
        redirect("/onboarding/package");
      }
      if (getViewerModel(sub) === "SUBSCRIPTION" && subscriptionPaymentRequired(sub)) {
        redirect("/profiles?payment=required");
      }
      const cookieStore = await cookies();
      const onboardingDeferred = cookieStore.get("st_onboarding_deferred")?.value === "1";
      if (user && !isViewerAccountOnboardingComplete(user) && !onboardingDeferred) {
        redirect("/onboarding/account");
      }
      const activeProfileId = cookieStore.get("st_viewer_profile")?.value;
      if (!activeProfileId) {
        redirect("/profiles");
      }
      if (user?.id) {
        const unlocked = await isViewerProfilePinUnlocked(user.id, activeProfileId, cookieStore);
        if (!unlocked) {
          redirect("/profiles?verify=1");
        }
      }
      subscriptionExpired = getViewerModel(sub) === "SUBSCRIPTION" ? isViewerSubscriptionExpired(sub) : false;
    } catch {
      // DB unreachable (e.g. wrong port or Neon suspended): still render layout
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground" data-browse-chrome>
      <Navbar />
      <main className="pb-20 pt-16 md:pb-0" data-spatial-nav-root>{children}</main>
      <BrowseMobileNav />
      <SubscriptionExpiredModal show={subscriptionExpired} />
      {session?.user && <ViewerSuggestionsTrigger />}
    </div>
  );
}
