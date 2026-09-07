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
      { status: 503 },
    );
  }

  const [listings, bookings, owners] = await Promise.all([
    prisma.locationListing.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true, email: true, professionalName: true } },
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
    prisma.user.findMany({
      where: { role: "LOCATION_OWNER" },
      select: { id: true, name: true, email: true, professionalName: true },
    }),
  ]);

  const listingCountByOwner = new Map<string, number>();
  const bookingCountByOwner = new Map<string, number>();
  const lastActivityByOwner = new Map<string, string>();

  for (const l of listings) {
    if (!l.companyId) continue;
    listingCountByOwner.set(l.companyId, (listingCountByOwner.get(l.companyId) || 0) + 1);
    const at = l.createdAt.toISOString();
    if (!lastActivityByOwner.has(l.companyId) || at > (lastActivityByOwner.get(l.companyId) || "")) {
      lastActivityByOwner.set(l.companyId, at);
    }
  }
  for (const b of bookings) {
    bookingCountByOwner.set(b.ownerId, (bookingCountByOwner.get(b.ownerId) || 0) + 1);
    const at = b.createdAt.toISOString();
    if (!lastActivityByOwner.has(b.ownerId) || at > (lastActivityByOwner.get(b.ownerId) || "")) {
      lastActivityByOwner.set(b.ownerId, at);
    }
  }

  const ownerSummaries = owners.map((o) => ({
    id: o.id,
    name: o.professionalName || o.name,
    email: o.email,
    listingCount: listingCountByOwner.get(o.id) || 0,
    bookingCount: bookingCountByOwner.get(o.id) || 0,
    lastActivityAt: lastActivityByOwner.get(o.id) || null,
  }));

  return NextResponse.json({
    listings,
    bookings,
    ownerCount: owners.length,
    owners: ownerSummaries,
  });
}
