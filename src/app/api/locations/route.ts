import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFeaturedCompanyPlan } from "@/lib/pricing";
import { parseEmbeddedMeta, embedMeta, type LocationMarketMeta } from "@/lib/marketplace-profile-meta";
import { validateStorageUrlList } from "@/lib/storage-origin";

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
  const region = req.nextUrl.searchParams.get("region");
  const availability = req.nextUrl.searchParams.get("availability");
  const now = new Date();

  const where: { companyId?: string | null; type?: string; city?: string; capacity?: { gte?: number }; dailyRate?: { lte?: number } } = {};
  if (ownerId) where.companyId = ownerId;
  if (type) where.type = type;
  if (city) where.city = city;
  if (!city && region) where.city = region;
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
          companySubscriptions: {
            where: { companyType: "LOCATION_OWNER", status: "ACTIVE", currentPeriodEnd: { gt: now } },
            take: 1,
            select: { plan: true },
          },
        },
      },
      _count: { select: { bookings: true } },
    },
  });
  const sorted = [...locations].sort((a, b) => {
    const promotedA = isFeaturedCompanyPlan((a.company as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    const promotedB = isFeaturedCompanyPlan((b.company as { companySubscriptions?: { plan: string }[] })?.companySubscriptions?.[0]?.plan) ? 0 : 1;
    return promotedA - promotedB || (a.name || "").localeCompare(b.name || "");
  });
  const shaped = sorted
    .map((location) => {
      const parsed = parseEmbeddedMeta<LocationMarketMeta>(location.rules);
      if (availability && !(location.availability ?? parsed.meta?.availability ?? "").toLowerCase().includes(availability.toLowerCase())) {
        return null;
      }
      return {
        ...location,
        profile: {
          permitRequirements: parsed.meta?.permitNotes ?? null,
          restrictions: parsed.meta?.restrictions ?? parsed.plain,
          hourlyRate: parsed.meta?.hourlyRate ?? null,
          dailyRate: parsed.meta?.dailyRate ?? location.dailyRate ?? null,
          availability: location.availability ?? parsed.meta?.availability ?? null,
          logistics: parsed.meta?.logistics ?? null,
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  return NextResponse.json(shaped);
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
  const photoErr = validateStorageUrlList(body.photoUrls, "photoUrls");
  if (photoErr) return NextResponse.json({ error: photoErr }, { status: 400 });
  const profile = body.profile ?? {};
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
      rules: embedMeta(body.rules || null, {
        hourlyRate: profile.hourlyRate ?? null,
        dailyRate: body.dailyRate != null ? parseFloat(String(body.dailyRate)) : null,
        permitRequired: !!profile.permitRequirements,
        permitNotes: profile.permitRequirements ?? null,
        restrictions: profile.restrictions ?? body.rules ?? null,
        logistics: profile.logistics ?? null,
        availability: body.availability || null,
      }),
      availability: body.availability || null,
      contactUrl: body.contactUrl || null,
      companyId: userId,
    },
  });
  return NextResponse.json(listing);
}
