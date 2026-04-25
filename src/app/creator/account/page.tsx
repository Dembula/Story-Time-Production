import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CreatorAccountClient } from "./creator-account-client";

function AccountPageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default async function CreatorAccountPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    redirect("/auth/signin");
  }

  return (
    <Suspense fallback={<AccountPageFallback />}>
      <CreatorAccountClient />
    </Suspense>
  );
}
