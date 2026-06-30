import { prisma } from "@/lib/prisma";

export async function listMealForecasts(cateringCompanyId: string) {
  return prisma.cateringMealForecast.findMany({
    where: { cateringCompanyId },
    orderBy: { eventDate: "asc" },
    include: { project: { select: { id: true, title: true } } },
  });
}

export async function upsertMealForecast(input: {
  cateringCompanyId: string;
  id?: string;
  projectId?: string | null;
  eventDate: string;
  headCount: number;
  breakfastCount?: number;
  lunchCount?: number;
  dinnerCount?: number;
  specialDiets?: number;
  notes?: string | null;
  status?: string;
}) {
  const data = {
    eventDate: input.eventDate,
    headCount: input.headCount,
    breakfastCount: input.breakfastCount ?? 0,
    lunchCount: input.lunchCount ?? 0,
    dinnerCount: input.dinnerCount ?? 0,
    specialDiets: input.specialDiets ?? 0,
    notes: input.notes ?? null,
    status: input.status ?? "DRAFT",
    projectId: input.projectId ?? null,
  };
  if (input.id) {
    return prisma.cateringMealForecast.update({ where: { id: input.id }, data });
  }
  return prisma.cateringMealForecast.create({
    data: { ...data, cateringCompanyId: input.cateringCompanyId },
  });
}

export async function mealForecastSummary(cateringCompanyId: string) {
  const forecasts = await listMealForecasts(cateringCompanyId);
  const upcoming = forecasts.filter((f) => f.eventDate >= new Date().toISOString().slice(0, 10));
  const totalMeals = upcoming.reduce(
    (sum, f) => sum + f.breakfastCount + f.lunchCount + f.dinnerCount,
    0,
  );
  return { upcomingCount: upcoming.length, totalMeals, forecasts: upcoming.slice(0, 6) };
}

export async function autoForecastFromBookings(cateringCompanyId: string) {
  const bookings = await prisma.cateringBooking.findMany({
    where: { cateringCompanyId, status: { in: ["APPROVED", "PENDING"] }, eventDate: { not: null } },
    take: 20,
  });
  let created = 0;
  for (const b of bookings) {
    if (!b.eventDate) continue;
    const existing = await prisma.cateringMealForecast.findFirst({
      where: { cateringCompanyId, eventDate: b.eventDate },
    });
    if (existing) continue;
    const head = b.headCount ?? 0;
    await prisma.cateringMealForecast.create({
      data: {
        cateringCompanyId,
        eventDate: b.eventDate,
        headCount: head,
        lunchCount: Math.ceil(head * 0.9),
        breakfastCount: Math.ceil(head * 0.4),
        dinnerCount: Math.ceil(head * 0.3),
        specialDiets: Math.ceil(head * 0.05),
        status: "AUTO",
        notes: `Auto-generated from booking ${b.id.slice(0, 8)}`,
      },
    });
    created++;
  }
  return { created };
}
