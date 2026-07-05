import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { safeCallbackPath } from "@/lib/auth-callback-path";
import { resolvePostSignInRedirect } from "@/lib/auth-sign-in-path";
import { buildPlatformRoleOptions } from "@/lib/platform-roles-shared";
import { resolveRoleSwitch } from "@/lib/platform-roles";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    role?: string;
    callbackUrl?: string;
  } | null;

  const requestedRole = typeof body?.role === "string" ? body.role.trim() : "";
  if (!requestedRole) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

  const outcome = await resolveRoleSwitch(
    userId,
    requestedRole,
    (session.user as { role?: string }).role,
  );

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  const callbackUrl = safeCallbackPath(body?.callbackUrl);
  const redirectUrl = resolvePostSignInRedirect(outcome.role, callbackUrl);

  return NextResponse.json({
    ok: true,
    activeRole: outcome.role,
    roles: outcome.roles,
    portalScope: outcome.portalScope,
    redirectUrl,
    options: buildPlatformRoleOptions(outcome.roles),
    session: {
      role: outcome.role,
      roles: outcome.roles,
      portalScope: outcome.portalScope,
      funderVerificationStatus: outcome.funderVerificationStatus,
      payoutKycVerificationStatus: outcome.payoutKycVerificationStatus,
    },
  });
}
