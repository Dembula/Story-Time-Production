import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { CreatorCateringClient } from "./creator-catering-client";

export default async function CreatorCateringPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    redirect(signInUrlForDestination("/creator/catering"));
  }

  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <CreatorCateringClient />
    </Suspense>
  );
}
