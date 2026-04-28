import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    const portalScope = req.nextauth.token?.portalScope as "VIEWER" | "CREATOR" | "ADMIN" | undefined;
    const funderVerificationStatus = req.nextauth.token?.funderVerificationStatus as
      | "PENDING"
      | "UNDER_REVIEW"
      | "APPROVED"
      | "REJECTED"
      | undefined;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/creator/join/")) {
      return NextResponse.next();
    }

    if (
      path.startsWith("/creator/company") &&
      (role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR")
    ) {
      return NextResponse.next();
    }

    if (portalScope === "ADMIN" && !path.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    if (portalScope === "VIEWER" && (path.startsWith("/admin") || path.startsWith("/creator") || path.startsWith("/music-creator") || path.startsWith("/equipment-company") || path.startsWith("/location-owner") || path.startsWith("/crew-team") || path.startsWith("/casting-agency") || path.startsWith("/company") || path.startsWith("/funders"))) {
      return NextResponse.redirect(new URL("/profiles", req.url));
    }
    if (portalScope === "CREATOR" && path.startsWith("/admin")) {
      const fallback = role === "MUSIC_CREATOR" ? "/music-creator/dashboard" : "/creator/command-center";
      return NextResponse.redirect(new URL(fallback, req.url));
    }

    if (path.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/auth/admin", req.url));
    }
    if (path.startsWith("/creator") && role !== "CONTENT_CREATOR") {
      return NextResponse.redirect(new URL("/auth/creator/signin", req.url));
    }
    if (path.startsWith("/music-creator") && role !== "MUSIC_CREATOR") {
      return NextResponse.redirect(new URL("/auth/creator/signin", req.url));
    }
    if (path.startsWith("/equipment-company") && role !== "EQUIPMENT_COMPANY") {
      return NextResponse.redirect(new URL("/auth/creator/signin", req.url));
    }
    if (path.startsWith("/location-owner") && role !== "LOCATION_OWNER") {
      return NextResponse.redirect(new URL("/auth/creator/signin", req.url));
    }
    if (path.startsWith("/crew-team") && role !== "CREW_TEAM") {
      return NextResponse.redirect(new URL("/auth/creator/signin", req.url));
    }
    if (path.startsWith("/casting-agency") && role !== "CASTING_AGENCY") {
      return NextResponse.redirect(new URL("/auth/creator/signin", req.url));
    }
    if (path.startsWith("/funders") && role !== "FUNDER") {
      return NextResponse.redirect(new URL("/auth/creator/signin", req.url));
    }
    if (
      path.startsWith("/funders") &&
      !path.startsWith("/funders/verification") &&
      role === "FUNDER" &&
      funderVerificationStatus !== "APPROVED"
    ) {
      return NextResponse.redirect(new URL("/funders/verification", req.url));
    }
    if (path.startsWith("/company/onboarding") && !["CREW_TEAM", "CASTING_AGENCY", "LOCATION_OWNER", "EQUIPMENT_COMPANY", "CATERING_COMPANY"].includes(role ?? "")) {
      return NextResponse.redirect(new URL("/auth/creator/signin", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith("/creator/join/")) return true;
        return !!token;
      },
    },
    pages: {
      signIn: "/auth/signin",
    },
  }
);

export const config = {
  matcher: ["/creator/:path*", "/music-creator/:path*", "/admin/:path*", "/equipment-company/:path*", "/location-owner/:path*", "/crew-team/:path*", "/casting-agency/:path*", "/company/:path*", "/funders/:path*"],
};
