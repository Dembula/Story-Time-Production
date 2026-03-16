import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function hasLocationModels(): boolean {
  return typeof (prisma as { locationListing?: unknown }).locationListing !== "undefined";
}

export async function GET(req: NextRequest) {
  if (!hasLocationModels()) {
    return NextResponse.json(
      { error: "Location models not loaded. Run: npm run refresh, then restart the dev server." },
      { status: 503 }
    );
  }
  const ownerId = req.nextUrl.searchParams.get("ownerId");
  const type = req.nextUrl.searchParams.get("type");
  const city = req.nextUrl.searchParams.get("city");
  const minCapacity = req.nextUrl.searchParams.get("minCapacity");
  const maxDailyRate = req.nextUrl.searchParams.get("maxDailyRate");

  const where: { companyId?: string | null; type?: string; city?: string; capacity?: { gte?: number }; dailyRate?: { lte?: number } } = {};
  if (ownerId) where.companyId = ownerId;
  if (type) where.type = type;
  if (city) where.city = city;
  if (minCapacity) where.capacity = { gte: parseInt(minCapacity, 10) };
  if (maxDailyRate) where.dailyRate = { lte: parseFloat(maxDailyRate) };

  const locations = await prisma.locationListing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          email: true,
          companySubscriptions: { where: { companyType: "LOCATION_OWNER", status: "ACTIVE" }, take: 1, select: { plan: true } },
        },
      },
      _count: { select: { bookings: true } },
    },
  });
  const sorted = [...locations].sort((a, b) => {
    const promotedA = (a.company as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan === "PROMOTED_R49" ? 0 : 1;
    const promotedB = (b.company as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan === "PROMOTED_R49" ? 0 : 1;
    return promotedA - promotedB || (a.name || "").localeCompare(b.name || "");
  });
  return NextResponse.json(sorted);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  const userId = (session.user as { id?: string })?.id!;

  if (role !== "LOCATION_OWNER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const listing = await prisma.locationListing.create({
    data: {
      name: body.name,
      description: body.description || null,
      type: body.type,
      address: body.address || null,
      city: body.city || null,
      province: body.province || null,
      country: body.country || null,
      capacity: body.capacity != null ? parseInt(String(body.capacity), 10) : null,
      dailyRate: body.dailyRate != null ? parseFloat(String(body.dailyRate)) : null,
      amenities: body.amenities || null,
      photoUrls: body.photoUrls || null,
      rules: body.rules || null,
      availability: body.availability || null,
      contactUrl: body.contactUrl || null,
      companyId: userId,
    },
  });
  return NextResponse.json(listing);
}
