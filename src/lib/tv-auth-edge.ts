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
  if (match?.[1]) return match[1];
  /* HTML5 <video> cannot send Authorization — TV players pass the JWT as tv_token. */
  const fromQuery = req.nextUrl.searchParams.get("tv_token")?.trim();
  if (fromQuery && fromQuery.length > 20 && fromQuery.length < 8192) return fromQuery;
  return null;
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
    /* Also expose as Authorization for handlers that read the header directly. */
    if (!headers.get("authorization")) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const profileId =
    (req.headers.get("x-st-viewer-profile") || "").trim() ||
    (req.nextUrl.searchParams.get("tv_profile") || "").trim();
  if (profileId && /^[a-zA-Z0-9_-]+$/.test(profileId)) {
    if (!existing.includes("st_viewer_profile=")) extras.push(`st_viewer_profile=${profileId}`);
    if (!existing.includes("st_viewer_profile_unlock=")) extras.push(`st_viewer_profile_unlock=${profileId}`);
    if (!headers.get("x-st-viewer-profile")) headers.set("x-st-viewer-profile", profileId);
  }

  if (extras.length) {
    headers.set("cookie", existing ? `${extras.join("; ")}; ${existing}` : extras.join("; "));
  }
  return headers;
}
