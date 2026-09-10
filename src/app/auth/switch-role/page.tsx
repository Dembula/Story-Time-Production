import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { safeCallbackPath } from "@/lib/auth-callback-path";
import { resolvePostSignInRedirect } from "@/lib/auth-sign-in-path";
import { normalizePlatformRole } from "@/lib/platform-roles-shared";
import { resolveRoleSwitch } from "@/lib/platform-roles";
import { SwitchRoleClient } from "./switch-role-client";

export default async function SwitchRolePage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; callbackUrl?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!session || !userId) {
    redirect("/auth/signin");
  }

  const params = await searchParams;
  const requestedRole = normalizePlatformRole(params.role);
  const callbackUrl = safeCallbackPath(params.callbackUrl);

  if (!requestedRole) {
    return (
      <SwitchRoleClient
        error="Missing or invalid profile."
        callbackUrl={callbackUrl}
      />
    );
  }

  const outcome = await resolveRoleSwitch(
    userId,
    requestedRole,
    (session.user as { role?: string }).role,
  );

  if (!outcome.ok) {
    return (
      <SwitchRoleClient
        error={outcome.error}
        callbackUrl={callbackUrl}
      />
    );
  }

  const redirectUrl = resolvePostSignInRedirect(outcome.role, callbackUrl, session.user.email);

  return (
    <SwitchRoleClient
      sessionPatch={{
        role: outcome.role,
        roles: outcome.roles,
        portalScope: outcome.portalScope,
        funderVerificationStatus: outcome.funderVerificationStatus,
        payoutKycVerificationStatus: outcome.payoutKycVerificationStatus,
        ...(outcome.role === "ADMIN"
          ? { adminRights: outcome.adminRights ?? null }
          : { adminRights: null }),
      }}
      redirectUrl={redirectUrl}
      roleLabel={requestedRole.replace(/_/g, " ")}
    />
  );
}
