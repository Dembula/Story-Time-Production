import { Navbar } from "@/components/layout/navbar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SubscriptionExpiredModal } from "./subscription-expired-modal";
import { ViewerSuggestionsTrigger } from "./viewer-suggestions-trigger";
import { cookies } from "next/headers";

export default async function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  let subscriptionExpired = false;

  if (session?.user?.email && role === "SUBSCRIBER") {
    const cookieStore = await cookies();
    const activeProfileId = cookieStore.get("st_viewer_profile")?.value;
    if (!activeProfileId) {
      redirect("/profiles");
    }
    try {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
          viewerSubscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      const sub = user?.viewerSubscriptions?.[0];
      if (!sub) {
        redirect("/onboarding/package");
      }
      const trialExpired = sub.status === "TRIAL_ACTIVE" && sub.trialEndsAt && new Date(sub.trialEndsAt) < new Date();
      const periodExpired = sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date();
      subscriptionExpired = trialExpired || periodExpired || sub.status === "PAST_DUE" || sub.status === "CANCELLED";
    } catch {
      // DB unreachable (e.g. wrong port or Neon suspended): still render layout
    }
  }

  return (
    <div className="min-h-screen bg-[#0c1222]">
      <Navbar />
      <main className="pt-16">{children}</main>
      <SubscriptionExpiredModal show={subscriptionExpired} />
      {session?.user && <ViewerSuggestionsTrigger />}
    </div>
  );
}
