import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function hasLocationModels(): boolean {
  return typeof (prisma as { locationBooking?: unknown }).locationBooking !== "undefined";
}

export async function GET(req: NextRequest) {
  if (!hasLocationModels()) {
    return NextResponse.json(
      { error: "Location models not loaded. Run: npm run refresh, then restart the dev server." },
      { status: 503 }
    );
  }
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id!;

  if (role === "LOCATION_OWNER" || role === "ADMIN") {
    const bookings = await prisma.locationBooking.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        location: { select: { id: true, name: true, type: true, city: true, dailyRate: true } },
        requester: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
    });
    return NextResponse.json(bookings);
  }

  const bookings = await prisma.locationBooking.findMany({
    where: { requesterId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      location: { select: { id: true, name: true, type: true, city: true, dailyRate: true, company: { select: { id: true, name: true } } } },
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { messages: true } },
    },
  });
  return NextResponse.json(bookings);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id?: string })?.id!;
  const body = await req.json();

  const location = await prisma.locationListing.findUnique({
    where: { id: body.locationId },
    select: { companyId: true },
  });

  if (!location?.companyId) {
    return NextResponse.json({ error: "Location not found or has no owner" }, { status: 400 });
  }

  const booking = await prisma.locationBooking.create({
    data: {
      locationId: body.locationId,
      requesterId: userId,
      ownerId: location.companyId,
      note: body.note || null,
      shootType: body.shootType || null,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      crewSize: body.crewSize != null ? parseInt(String(body.crewSize), 10) : null,
    },
    include: {
      location: { select: { name: true, type: true, city: true } },
    },
  });

  return NextResponse.json(booking);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const existing = await prisma.locationBooking.findUnique({
    where: { id: body.id },
    select: { ownerId: true },
  });

  if (!existing) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id!;
  if (existing.ownerId !== userId && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.locationBooking.update({
    where: { id: body.id },
    data: { status: body.status },
  });
  return NextResponse.json(updated);
}
