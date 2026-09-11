import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const start30d = new Date(now);
  start30d.setDate(start30d.getDate() - 30);
  const start7d = new Date(now);
  start7d.setDate(start7d.getDate() - 7);
  const start15m = new Date(now.getTime() - 15 * 60 * 1000);
  const start1h = new Date(now.getTime() - 60 * 60 * 1000);

  const [
    eventsCount,
    topEvents,
    topPaths,
    crashes7d,
    clientErrors7d,
    pageViews7d,
    activeEvents15m,
    recentCrashes,
    liveTopPaths,
    liveTopEvents,
  ] = await Promise.all([
    prisma.analyticsEvent.count({ where: { createdAt: { gte: start30d, lte: now } } }),
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { createdAt: { gte: start30d, lte: now } },
      _count: { _all: true },
      orderBy: { _count: { name: "desc" } },
      take: 10,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["path"],
      where: { createdAt: { gte: start30d, lte: now }, path: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 10,
    }),
    prisma.analyticsEvent.count({
      where: { createdAt: { gte: start7d, lte: now }, name: { in: ["web_crash", "client_error"] } },
    }),
    prisma.analyticsEvent.count({
      where: { createdAt: { gte: start7d, lte: now }, name: "client_error" },
    }),
    prisma.analyticsEvent.count({
      where: { createdAt: { gte: start7d, lte: now }, name: { in: ["page_view", "route_view"] } },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: start15m, lte: now },
        name: { in: ["page_view", "route_view", "heartbeat"] },
      },
      select: { userId: true, path: true, properties: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: start7d, lte: now },
        name: { in: ["web_crash", "client_error"] },
      },
      select: { id: true, name: true, path: true, properties: true, createdAt: true, userId: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["path"],
      where: {
        createdAt: { gte: start1h, lte: now },
        path: { not: null },
        name: { in: ["page_view", "route_view", "heartbeat"] },
      },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 8,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { createdAt: { gte: start1h, lte: now } },
      _count: { _all: true },
      orderBy: { _count: { name: "desc" } },
      take: 8,
    }),
  ]);

  const activeKeys = new Set<string>();
  for (const row of activeEvents15m) {
    if (row.userId) {
      activeKeys.add(`u:${row.userId}`);
      continue;
    }
    const props = (row.properties ?? {}) as { ipHint?: string; viewport?: string };
    activeKeys.add(`a:${props.ipHint ?? "anon"}:${props.viewport ?? ""}:${row.path ?? ""}`);
  }

  return NextResponse.json({
    window: { startIso: start30d.toISOString(), endIso: now.toISOString() },
    eventsCount,
    topEvents: topEvents.map((e) => ({ name: e.name, count: e._count._all })),
    topPaths: topPaths.map((p) => ({ path: p.path, count: p._count._all })),
    live: {
      activeUsersApprox: activeKeys.size,
      windowMinutes: 15,
      pageViews7d,
      crashes7d,
      clientErrors7d,
      topPaths1h: liveTopPaths.map((p) => ({ path: p.path, count: p._count._all })),
      topEvents1h: liveTopEvents.map((e) => ({ name: e.name, count: e._count._all })),
      recentCrashes: recentCrashes.map((c) => ({
        id: c.id,
        name: c.name,
        path: c.path,
        createdAt: c.createdAt.toISOString(),
        message:
          typeof (c.properties as { message?: unknown } | null)?.message === "string"
            ? String((c.properties as { message: string }).message).slice(0, 160)
            : null,
        mobile:
          typeof (c.properties as { isMobileLike?: unknown } | null)?.isMobileLike === "boolean"
            ? Boolean((c.properties as { isMobileLike: boolean }).isMobileLike)
            : null,
      })),
    },
  });
}
