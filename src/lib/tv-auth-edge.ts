import type { NextRequest } from "next/server";

export const TV_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, X-ST-Platform, X-ST-Device, X-ST-Viewer-Profile",
  "Access-Control-Max-Age": "86400",
};

export function nextAuthSessionCookieName(): string {
  const url = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://story-time.online").trim();
  return url.startsWith("https://") ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}

export function authorizationBearer(req: NextRequest): string | null {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  return match?.[1] ?? null;
}

/** Copy a TV Bearer JWT onto the NextAuth cookie name so getServerSession/getToken work. */
export function headersWithInjectedSessionCookie(req: NextRequest): Headers {
  const headers = new Headers(req.headers);
  const extras: string[] = [];
  const token = authorizationBearer(req);
  const existing = headers.get("cookie") || "";

  if (token) {
    const name = nextAuthSessionCookieName();
    if (!existing.includes(`${name}=`)) extras.push(`${name}=${token}`);
  }

  const profileId = (req.headers.get("x-st-viewer-profile") || "").trim();
  if (profileId && /^[a-zA-Z0-9_-]+$/.test(profileId)) {
    if (!existing.includes("st_viewer_profile=")) extras.push(`st_viewer_profile=${profileId}`);
    if (!existing.includes("st_viewer_profile_unlock=")) extras.push(`st_viewer_profile_unlock=${profileId}`);
  }

  if (extras.length) {
    headers.set("cookie", existing ? `${extras.join("; ")}; ${existing}` : extras.join("; "));
  }
  return headers;
}
