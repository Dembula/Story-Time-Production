import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (typeof (prisma as { locationListing?: unknown }).locationListing === "undefined") {
    return NextResponse.json(
      { error: "Location models not loaded. Run: npm run refresh, then restart the dev server." },
      { status: 503 }
    );
  }

  const [listings, bookings, ownerCount] = await Promise.all([
    prisma.locationListing.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true, email: true } },
        _count: { select: { bookings: true } },
      },
    }),
    prisma.locationBooking.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        location: { select: { id: true, name: true, type: true, city: true, dailyRate: true } },
        requester: { select: { id: true, name: true, email: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.user.count({ where: { role: "LOCATION_OWNER" } }),
  ]);

  return NextResponse.json({ listings, bookings, ownerCount });
}
