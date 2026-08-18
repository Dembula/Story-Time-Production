import { encode, decode, type JWT } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { compare } from "bcryptjs";
import { findUserForCredentialsLogin } from "@/lib/prisma-user-studio-compat";
import { VIEWER_ROLES, getUserRoles } from "@/lib/user-roles";
import { getPortalScopeForRole } from "@/lib/platform-roles-shared";
import { authorizationBearer } from "@/lib/tv-auth-edge";

export { TV_CORS_HEADERS, nextAuthSessionCookieName, authorizationBearer, headersWithInjectedSessionCookie } from "@/lib/tv-auth-edge";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export type TvSessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: string;
  roles: string[];
  portalScope: "VIEWER" | "CREATOR" | "ADMIN";
};

export type TvSession = { user: TvSessionUser };

function jwtToSession(token: JWT): TvSession | null {
  const id = (token.id as string | undefined) || (token.sub as string | undefined);
  if (!id) return null;
  const email = (token.email as string | null | undefined) ?? null;
  const roles = (token.roles as string[] | undefined) ?? [];
  const role = (token.role as string | undefined) || roles[0] || "SUBSCRIBER";
  return {
    user: {
      id,
      email,
      name: (token.name as string | null | undefined) ?? null,
      image: (token.picture as string | null | undefined) ?? null,
      role,
      roles: roles.length ? roles : [role],
      portalScope:
        ((token as { portalScope?: "VIEWER" | "CREATOR" | "ADMIN" }).portalScope as
          | "VIEWER"
          | "CREATOR"
          | "ADMIN"
          | undefined) ?? getPortalScopeForRole(role),
    },
  };
}

export async function decodeTvAccessToken(token: string): Promise<TvSession | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || !token) return null;
  try {
    const jwt = await decode({ token, secret });
    if (!jwt) return null;
    return jwtToSession(jwt);
  } catch {
    return null;
  }
}

export async function sessionFromTvRequest(req: NextRequest): Promise<TvSession | null> {
  const bearer = authorizationBearer(req);
  if (bearer) return decodeTvAccessToken(bearer);
  return null;
}

export async function issueTvAccessToken(user: {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: string;
  roles: string[];
  activeCreatorStudioProfileId?: string | null;
}): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not configured");
  const role = user.role || "SUBSCRIBER";
  return encode({
    token: {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.image,
      role,
      roles: user.roles,
      portalScope: getPortalScopeForRole(role),
      activeCreatorStudioProfileId: user.activeCreatorStudioProfileId ?? null,
    } as JWT,
    secret,
    maxAge: SESSION_MAX_AGE,
  });
}

export async function authenticateViewerCredentials(
  emailRaw: string,
  password: string,
): Promise<{ ok: true; session: TvSession; token: string } | { ok: false; error: string; status: number }> {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (!email || password == null || password === "") {
    return { ok: false, error: "Email and password are required.", status: 400 };
  }

  const user = await findUserForCredentialsLogin(email);
  if (!user || !user.passwordHash) {
    return { ok: false, error: "Invalid email or password.", status: 401 };
  }
  const passwordOk = await compare(password, user.passwordHash);
  if (!passwordOk) {
    return { ok: false, error: "Invalid email or password.", status: 401 };
  }

  const roles = await getUserRoles(user.id, user.role);
  if (![...roles].some((role) => VIEWER_ROLES.has(role))) {
    return { ok: false, error: "This account cannot sign in on TV. Use a viewer subscription account.", status: 403 };
  }

  const role = "SUBSCRIBER";
  const session: TvSession = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role,
      roles: [...roles],
      portalScope: "VIEWER",
    },
  };
  const token = await issueTvAccessToken({
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role,
    roles: [...roles],
    activeCreatorStudioProfileId: user.activeCreatorStudioProfileId,
  });
  return { ok: true, session, token };
}
