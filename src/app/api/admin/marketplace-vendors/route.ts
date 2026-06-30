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
        include: { user: { select: { id: true, email: true } } },
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

  const recentEquipment = await prisma.equipmentRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      equipment: { select: { companyName: true } },
      requester: { select: { name: true } },
      company: { select: { name: true, email: true } },
    },
  });

  const recentCatering = await prisma.cateringBooking.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      cateringCompany: { select: { companyName: true } },
      creator: { select: { name: true } },
    },
  });

  return NextResponse.json({
    equipmentCompanies,
    cateringCompanies,
    requestStats: equipmentRequests,
    bookingStats: cateringBookings,
    inventoryTagCount: inventoryTags,
    mealForecastCount: forecasts,
    recentEquipment,
    recentCatering,
  });
}
