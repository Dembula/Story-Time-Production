import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [equipmentCompanies, cateringCompanies, equipmentRequests, cateringBookings, inventoryTags, forecasts] =
    await Promise.all([
      prisma.user.findMany({
        where: { role: "EQUIPMENT_COMPANY" },
        select: { id: true, name: true, email: true, professionalName: true },
        take: 100,
      }),
      prisma.cateringCompany.findMany({
        take: 100,
        include: {
          user: { select: { id: true, email: true, name: true } },
          _count: { select: { bookings: true, mealForecasts: true } },
        },
      }),
      prisma.equipmentRequest.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.cateringBooking.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.equipmentInventoryTag.count(),
      prisma.cateringMealForecast.count(),
    ]);

  const equipmentListingCounts = await prisma.equipmentListing.groupBy({
    by: ["companyId"],
    _count: { _all: true },
    where: { companyId: { not: null } },
  });
  const equipmentRequestCounts = await prisma.equipmentRequest.groupBy({
    by: ["companyId"],
    _count: { _all: true },
  });
  const listingMap = new Map(
    equipmentListingCounts.filter((r) => r.companyId).map((r) => [r.companyId as string, r._count._all]),
  );
  const requestMap = new Map(equipmentRequestCounts.map((r) => [r.companyId, r._count._all]));

  const recentEquipment = await prisma.equipmentRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      equipment: { select: { companyName: true } },
      requester: { select: { name: true } },
      company: { select: { id: true, name: true, email: true } },
    },
  });

  const recentCatering = await prisma.cateringBooking.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      cateringCompany: { select: { id: true, companyName: true } },
      creator: { select: { name: true } },
    },
  });

  return NextResponse.json({
    equipmentCompanies: equipmentCompanies.map((c) => ({
      ...c,
      listingCount: listingMap.get(c.id) || 0,
      requestCount: requestMap.get(c.id) || 0,
    })),
    cateringCompanies: cateringCompanies.map((c) => ({
      id: c.id,
      companyName: c.companyName,
      user: c.user,
      bookingCount: c._count.bookings,
      forecastCount: c._count.mealForecasts,
    })),
    requestStats: equipmentRequests,
    bookingStats: cateringBookings,
    inventoryTagCount: inventoryTags,
    mealForecastCount: forecasts,
    recentEquipment,
    recentCatering,
  });
}
