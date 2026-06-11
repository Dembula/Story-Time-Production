import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireCreatorPackageComplete } from "@/lib/creator-package-gate";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { MusicDashboardClient } from "./music-dashboard-client";

export default async function MusicCreatorDashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "MUSIC_CREATOR" && role !== "ADMIN")) {
    redirect(signInUrlForDestination("/music-creator/dashboard"));
  }

  const userId = (session.user as { id?: string }).id;
  if (role === "MUSIC_CREATOR" && userId) {
    await requireCreatorPackageComplete(userId, role);
  }

  return <MusicDashboardClient />;
}
