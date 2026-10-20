import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIpFromRequest, rateLimitedResponse } from "@/lib/auth-rate-limit";
import { findUserForCredentialsLogin } from "@/lib/prisma-user-studio-compat";
import { isMfaActive } from "@/lib/mfa/login-gate";
import { CREATOR_ROLES, VIEWER_ROLES, getUserRoles } from "@/lib/user-roles";

type Portal = "viewer" | "creator" | "admin";

/**
 * Password-only precheck: tells the client whether MFA is required AFTER password
 * succeeds for this portal. Never requires an MFA code here — only reports status.
 * Accounts without MFA enabled always get mfaRequired: false.
 */
export async function POST(request: NextRequest) {
  const rate = await checkRateLimit({
    key: "auth-mfa-precheck",
    ip: getClientIpFromRequest(request),
    maxAttempts: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!rate.allowed) {
    return rateLimitedResponse(rate.retryAfterSeconds, "Too many attempts. Try again later.");
  }

  let body: { email?: unknown; password?: unknown; portal?: unknown; selectedRole?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const portal = (typeof body.portal === "string" ? body.portal.trim().toLowerCase() : "") as Portal;
  if (!email || !password || !["viewer", "creator", "admin"].includes(portal)) {
    return NextResponse.json({ error: "Email, password, and portal are required." }, { status: 400 });
  }

  const user = await findUserForCredentialsLogin(email);
  // Same opaque response for unknown users / bad password — do not leak MFA status.
  if (!user?.passwordHash) {
    return NextResponse.json({ ok: false, mfaRequired: false });
  }
  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) {
    return NextResponse.json({ ok: false, mfaRequired: false });
  }

  const roles = await getUserRoles(user.id, user.role);
  let portalOk = false;
  if (portal === "viewer") {
    portalOk = [...roles].some((r) => VIEWER_ROLES.has(r));
  } else if (portal === "admin") {
    portalOk = roles.has("ADMIN");
  } else {
    // Require an explicit account type — same rule as credentials-creator authorize.
    const selectedRole =
      typeof body.selectedRole === "string" && body.selectedRole.trim()
        ? body.selectedRole.trim().toUpperCase()
        : null;
    portalOk = Boolean(
      selectedRole && CREATOR_ROLES.has(selectedRole) && roles.has(selectedRole),
    );
  }

  if (!portalOk) {
    return NextResponse.json({ ok: false, mfaRequired: false });
  }

  return NextResponse.json({
    ok: true,
    mfaRequired: isMfaActive(user),
  });
}
