import { StoryTimeLoader, StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { CreatorAccountClient } from "@/app/creator/account/creator-account-client";

function AccountPageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <StoryTimeLoader size="sm" hideTrack />
    </div>
  );
}

export default async function MusicCreatorAccountPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "MUSIC_CREATOR" && role !== "ADMIN")) {
    redirect(signInUrlForDestination("/music-creator/account"));
  }

  return (
    <Suspense fallback={<AccountPageFallback />}>
      <CreatorAccountClient backHref="/music-creator/dashboard" />
    </Suspense>
  );
}
