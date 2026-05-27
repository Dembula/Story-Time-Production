import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireCreatorPackageComplete } from "@/lib/creator-package-gate";
import { CommandCenterClient } from "./command-center-client";

export default async function CommandCenterPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) redirect("/auth/signin");

  const userId = (session.user as { id?: string }).id;
  if (role === "CONTENT_CREATOR" && userId) {
    await requireCreatorPackageComplete(userId, role);
  }

  return <CommandCenterClient />;
}
