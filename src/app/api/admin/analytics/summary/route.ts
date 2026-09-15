import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  humanizeAdminPath,
  humanizeClientErrorMessage,
  humanizeDeviceLabel,
  humanizeEventName,
  humanizeUserRole,
} from "@/lib/admin-ops-labels";

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
      select: { userId: true, path: true, properties: true, createdAt: true, role: true },
      orderBy: { createdAt: "desc" },
      take: 400,
    }),
    prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: start7d, lte: now },
        name: { in: ["web_crash", "client_error"] },
      },
      select: {
        id: true,
        name: true,
        path: true,
        properties: true,
        createdAt: true,
        userId: true,
        role: true,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
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
      take: 10,
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

  const crashUserIds = Array.from(
    new Set(recentCrashes.map((c) => c.userId).filter(Boolean) as string[]),
  );
  const activeUserIds = Array.from(
    new Set(activeEvents15m.map((e) => e.userId).filter(Boolean) as string[]),
  );
  const allUserIds = Array.from(new Set([...crashUserIds, ...activeUserIds]));
  const users = allUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, name: true, email: true, role: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const recentActivityPeople = (() => {
    const seen = new Set<string>();
    const rows: Array<{
      key: string;
      who: string;
      roleLabel: string;
      where: string;
      when: string;
    }> = [];
    for (const event of activeEvents15m) {
      const key = event.userId ? `u:${event.userId}` : `a:${event.path ?? ""}:${event.createdAt.toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const user = event.userId ? userById.get(event.userId) : null;
      rows.push({
        key,
        who: user?.name?.trim() || user?.email?.trim() || "Guest visitor",
        roleLabel: humanizeUserRole(user?.role ?? event.role),
        where: humanizeAdminPath(event.path),
        when: event.createdAt.toISOString(),
      });
      if (rows.length >= 12) break;
    }
    return rows;
  })();

  return NextResponse.json({
    window: { startIso: start30d.toISOString(), endIso: now.toISOString() },
    eventsCount,
    topEvents: topEvents.map((e) => ({
      name: e.name,
      label: humanizeEventName(e.name),
      count: e._count._all,
    })),
    topPaths: topPaths.map((p) => ({
      path: p.path,
      label: humanizeAdminPath(p.path),
      count: p._count._all,
    })),
    live: {
      activeUsersApprox: activeKeys.size,
      windowMinutes: 15,
      pageViews7d,
      crashes7d,
      clientErrors7d,
      topPaths1h: liveTopPaths.map((p) => ({
        path: p.path,
        label: humanizeAdminPath(p.path),
        count: p._count._all,
      })),
      topEvents1h: liveTopEvents.map((e) => ({
        name: e.name,
        label: humanizeEventName(e.name),
        count: e._count._all,
      })),
      recentPeople: recentActivityPeople,
      recentCrashes: recentCrashes.map((c) => {
        const props = (c.properties ?? {}) as {
          message?: string;
          isMobileLike?: boolean;
          isIOS?: boolean;
          browser?: string;
          family?: string;
          kind?: string;
        };
        const plain = humanizeClientErrorMessage(props.message);
        const user = c.userId ? userById.get(c.userId) : null;
        return {
          id: c.id,
          name: c.name,
          nameLabel: humanizeEventName(c.name),
          path: c.path,
          where: humanizeAdminPath(c.path),
          createdAt: c.createdAt.toISOString(),
          message: typeof props.message === "string" ? props.message.slice(0, 220) : null,
          title: plain.title,
          summary: plain.summary,
          severity: plain.severity,
          who: user?.name?.trim() || user?.email?.trim() || "Guest visitor",
          roleLabel: humanizeUserRole(user?.role ?? c.role),
          device: humanizeDeviceLabel({
            mobile: props.isMobileLike,
            isIOS: props.isIOS,
            browser: props.browser,
            family: props.family,
          }),
          mobile: typeof props.isMobileLike === "boolean" ? props.isMobileLike : null,
        };
      }),
    },
  });
}
