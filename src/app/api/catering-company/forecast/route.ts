import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  autoForecastFromBookings,
  listMealForecasts,
  upsertMealForecast,
} from "@/lib/stakeholder-ecosystem/meal-forecast-service";

async function requireCateringCompany() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId || role !== "CATERING_COMPANY") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const company = await prisma.cateringCompany.findFirst({ where: { userId }, select: { id: true } });
  if (!company) return { error: NextResponse.json({ error: "Company not found" }, { status: 404 }) };
  return { userId, companyId: company.id };
}

export async function GET() {
  const access = await requireCateringCompany();
  if (access.error) return access.error;
  const forecasts = await listMealForecasts(access.companyId!);
  return NextResponse.json({ forecasts });
}

export async function POST(req: NextRequest) {
  const access = await requireCateringCompany();
  if (access.error) return access.error;
  const body = await req.json().catch(() => ({}));

  if (body.action === "auto_from_bookings") {
    const result = await autoForecastFromBookings(access.companyId!);
    return NextResponse.json(result);
  }

  if (!body.eventDate || body.headCount == null) {
    return NextResponse.json({ error: "eventDate and headCount required" }, { status: 400 });
  }

  const forecast = await upsertMealForecast({
    cateringCompanyId: access.companyId!,
    id: body.id,
    projectId: body.projectId,
    eventDate: body.eventDate,
    headCount: Number(body.headCount),
    breakfastCount: body.breakfastCount,
    lunchCount: body.lunchCount,
    dinnerCount: body.dinnerCount,
    specialDiets: body.specialDiets,
    notes: body.notes,
    status: body.status,
  });
  return NextResponse.json({ forecast });
}
