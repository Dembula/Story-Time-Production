import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { signInUrlForDestination } from "@/lib/auth-sign-in-path";
import { requiredRoleForProtectedPath } from "@/lib/platform-roles-shared";
import { userHasPlatformRole } from "@/lib/user-roles-shared";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Title detail pages are browsable without completing viewer onboarding.
  if (/^\/browse\/content\/[^/]+$/.test(path)) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-browse-public-detail", "1");
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  if (path.startsWith("/browse/account")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-browse-account-access", "1");
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  if (path.startsWith("/creator/join/")) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.redirect(new URL(signInUrlForDestination(path), req.url));
  }

  const role = token.role as string | undefined;
  const portalScope = token.portalScope as "VIEWER" | "CREATOR" | "ADMIN" | undefined;

    if (
      path.startsWith("/creator/company") &&
      (role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR")
    ) {
      return NextResponse.next();
    }

    if (portalScope === "ADMIN" && !path.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    if (
      portalScope === "VIEWER" &&
      (path.startsWith("/admin") ||
        path.startsWith("/creator") ||
        path.startsWith("/music-creator") ||
        path.startsWith("/equipment-company") ||
        path.startsWith("/location-owner") ||
        path.startsWith("/crew-team") ||
        path.startsWith("/casting-agency") ||
        path.startsWith("/catering-company") ||
        path.startsWith("/company") ||
        path.startsWith("/funders") ||
        path.startsWith("/wallet"))
    ) {
      return NextResponse.redirect(new URL("/profiles", req.url));
    }
    if (portalScope === "CREATOR" && path.startsWith("/admin")) {
      const fallback = role === "MUSIC_CREATOR" ? "/music-creator/dashboard" : "/creator/command-center";
      return NextResponse.redirect(new URL(fallback, req.url));
    }

    const tokenRoles = (token.roles as string[] | undefined) ?? [];
    const requiredRole = requiredRoleForProtectedPath(path);
    if (requiredRole && role !== requiredRole && userHasPlatformRole(tokenRoles, requiredRole)) {
      const switchUrl = new URL("/auth/switch-role", req.url);
      switchUrl.searchParams.set("role", requiredRole);
      switchUrl.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(switchUrl);
    }

    if (path.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/auth/admin", req.url));
    }
    if (path.startsWith("/creator") && role !== "CONTENT_CREATOR") {
      return NextResponse.redirect(new URL(signInUrlForDestination(path), req.url));
    }
    if (path.startsWith("/music-creator") && role !== "MUSIC_CREATOR") {
      return NextResponse.redirect(new URL(signInUrlForDestination(path), req.url));
    }
    if (path.startsWith("/equipment-company") && role !== "EQUIPMENT_COMPANY") {
      return NextResponse.redirect(new URL(signInUrlForDestination(path), req.url));
    }
    if (path.startsWith("/location-owner") && role !== "LOCATION_OWNER") {
      return NextResponse.redirect(new URL(signInUrlForDestination(path), req.url));
    }
    if (path.startsWith("/crew-team") && role !== "CREW_TEAM") {
      return NextResponse.redirect(new URL(signInUrlForDestination(path), req.url));
    }
    if (path.startsWith("/casting-agency") && role !== "CASTING_AGENCY") {
      return NextResponse.redirect(new URL(signInUrlForDestination(path), req.url));
    }
    if (path.startsWith("/catering-company") && role !== "CATERING_COMPANY") {
      return NextResponse.redirect(new URL(signInUrlForDestination(path), req.url));
    }
    if (path.startsWith("/funders") && role !== "FUNDER") {
      return NextResponse.redirect(new URL(signInUrlForDestination(path), req.url));
    }
    if (path.startsWith("/company/onboarding") && !["CREW_TEAM", "CASTING_AGENCY", "LOCATION_OWNER", "EQUIPMENT_COMPANY", "CATERING_COMPANY"].includes(role ?? "")) {
      return NextResponse.redirect(new URL(signInUrlForDestination(path), req.url));
    }
    if (path.startsWith("/wallet") && role === "SUBSCRIBER") {
      return NextResponse.redirect(new URL("/profiles", req.url));
    }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/browse/content/:id",
    "/browse/account",
    "/browse/account/:path*",
    "/creator/:path*",
    "/music-creator/:path*",
    "/admin/:path*",
    "/equipment-company/:path*",
    "/location-owner/:path*",
    "/crew-team/:path*",
    "/casting-agency/:path*",
    "/catering-company/:path*",
    "/company/:path*",
    "/funders/:path*",
    "/wallet/:path*",
    "/payout-verification/:path*",
  ],
};
