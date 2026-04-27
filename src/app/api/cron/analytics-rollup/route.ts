import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorizedCronCall(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${expected}`;
}

const UTC_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const prevStart = new Date(dayStart.getTime() - UTC_DAY_MS);
  const prevEnd = new Date(dayStart.getTime() - 1);
  const dayKey = prevStart.toISOString().slice(0, 10);

  const grouped = await prisma.analyticsEvent.groupBy({
    by: ["name"],
    where: { createdAt: { gte: prevStart, lte: prevEnd } },
    _count: { _all: true },
  });

  for (const g of grouped) {
    await prisma.analyticsDailyRollup.upsert({
      where: { day_name: { day: dayKey, name: g.name } },
      update: { count: g._count._all },
      create: { day: dayKey, name: g.name, count: g._count._all },
    });
  }

  return NextResponse.json({ ok: true, day: dayKey, eventTypes: grouped.length });
}
