import { Navbar } from "@/components/layout/navbar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SubscriptionExpiredModal } from "./subscription-expired-modal";
import { ViewerSuggestionsTrigger } from "./viewer-suggestions-trigger";
import { cookies } from "next/headers";
import { getLatestViewerSubscription, getViewerModel, isViewerSubscriptionExpired } from "@/lib/viewer-access";

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
        select: { id: true },
      });
      const sub = user?.id ? await getLatestViewerSubscription(user.id) : null;
      if (!sub) {
        redirect("/onboarding/package");
      }
      const cookieStore = await cookies();
      const activeProfileId = cookieStore.get("st_viewer_profile")?.value;
      if (!activeProfileId) {
        redirect("/profiles");
      }
      subscriptionExpired = getViewerModel(sub) === "SUBSCRIPTION" ? isViewerSubscriptionExpired(sub) : false;
    } catch {
      // DB unreachable (e.g. wrong port or Neon suspended): still render layout
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-16">{children}</main>
      <SubscriptionExpiredModal show={subscriptionExpired} />
      {session?.user && <ViewerSuggestionsTrigger />}
    </div>
  );
}
