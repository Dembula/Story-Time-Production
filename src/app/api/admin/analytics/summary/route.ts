import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 30);

  const [eventsCount, topEvents, topPaths] = await Promise.all([
    prisma.analyticsEvent.count({ where: { createdAt: { gte: start, lte: now } } }),
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { createdAt: { gte: start, lte: now } },
      _count: { _all: true },
      orderBy: { _count: { name: "desc" } },
      take: 10,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["path"],
      where: { createdAt: { gte: start, lte: now }, path: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    window: { startIso: start.toISOString(), endIso: now.toISOString() },
    eventsCount,
    topEvents: topEvents.map((e) => ({ name: e.name, count: e._count._all })),
    topPaths: topPaths.map((p) => ({ path: p.path, count: p._count._all })),
  });
}
