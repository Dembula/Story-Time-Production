import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireCreatorPackageComplete } from "@/lib/creator-package-gate";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { userHasPlatformRole } from "@/lib/user-roles-shared";
import { CommandCenterClient } from "./command-center-client";

export default async function CommandCenterPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!session) {
    redirect(signInUrlForDestination("/creator/command-center"));
  }
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    if (userHasPlatformRole(roles, "CONTENT_CREATOR")) {
      redirect(
        `/auth/switch-role?role=CONTENT_CREATOR&callbackUrl=${encodeURIComponent("/creator/command-center")}`,
      );
    }
    redirect(signInUrlForDestination("/creator/command-center"));
  }

  const userId = (session.user as { id?: string }).id;
  if (role === "CONTENT_CREATOR" && userId) {
    await requireCreatorPackageComplete(userId, role);
  }

  return <CommandCenterClient />;
}
