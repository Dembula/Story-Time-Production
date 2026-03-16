import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CreatorAccountClient } from "@/app/creator/account/creator-account-client";

export default async function MusicCreatorAccountPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "MUSIC_CREATOR" && role !== "ADMIN")) {
    redirect("/auth/signin");
  }

  return <CreatorAccountClient backHref="/music-creator/dashboard" />;
}
