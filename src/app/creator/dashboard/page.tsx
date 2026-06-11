import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireCreatorPackageComplete } from "@/lib/creator-package-gate";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { CreatorProjectsDashboardClient } from "./creator-projects-dashboard-client";

export default async function CreatorDashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    redirect(signInUrlForDestination("/creator/dashboard"));
  }

  const userId = (session.user as { id?: string }).id;
  if (role === "CONTENT_CREATOR" && userId) {
    await requireCreatorPackageComplete(userId, role);
  }

  return (
    <div className="px-6 py-8 md:px-12 md:py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        <CreatorProjectsDashboardClient />
      </div>
    </div>
  );
}
