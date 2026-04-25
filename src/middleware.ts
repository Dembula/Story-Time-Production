import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/creator/join/")) {
      return NextResponse.next();
    }

    if (
      path.startsWith("/creator/company") &&
      (role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR" || role === "ADMIN")
    ) {
      return NextResponse.next();
    }

    if (path.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/browse", req.url));
    }
    if (path.startsWith("/creator") && role !== "CONTENT_CREATOR" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/browse", req.url));
    }
    if (path.startsWith("/music-creator") && role !== "MUSIC_CREATOR" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/browse", req.url));
    }
    if (path.startsWith("/equipment-company") && role !== "EQUIPMENT_COMPANY" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/browse", req.url));
    }
    if (path.startsWith("/location-owner") && role !== "LOCATION_OWNER" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/browse", req.url));
    }
    if (path.startsWith("/crew-team") && role !== "CREW_TEAM" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/browse", req.url));
    }
    if (path.startsWith("/casting-agency") && role !== "CASTING_AGENCY" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/browse", req.url));
    }
    if (path.startsWith("/company/onboarding") && !["CREW_TEAM", "CASTING_AGENCY", "LOCATION_OWNER", "EQUIPMENT_COMPANY", "CATERING_COMPANY", "ADMIN"].includes(role ?? "")) {
      return NextResponse.redirect(new URL("/browse", req.url));
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
  matcher: ["/creator/:path*", "/music-creator/:path*", "/admin/:path*", "/equipment-company/:path*", "/location-owner/:path*", "/crew-team/:path*", "/casting-agency/:path*", "/company/:path*"],
};
