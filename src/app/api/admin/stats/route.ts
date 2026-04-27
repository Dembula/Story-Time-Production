import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlatformStats } from "@/lib/revenue";
import { Prisma } from "../../../../../generated/prisma";

const TELEMETRY_LOOKBACK_DAYS = 90;

type IpAggRow = { ipAddress: string; count: bigint; lastSeen: Date; userSample: string | null };
type DeviceAggRow = { deviceType: string; count: bigint };
type SignInRoleRow = { role: string; count: bigint };
type WatchAggRow = { distinctUsers: bigint; totalSeconds: bigint | null };

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date();
  const telemetrySince = new Date(now.getTime() - TELEMETRY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const stats = await getPlatformStats(periodStart, periodEnd);

  const [
    contentByType,
    usersByRole,
    recentActivity,
    totalTracks,
    totalSyncDeals,
    afdaStudents,
    crewTeamCount,
    crewTotalMembers,
    crewRequestCount,
    castingAgencyCount,
    castTotalTalent,
    castInquiryCount,
    auditionCount,
    ipRows,
    deviceRows,
    signInRoleRows,
    watchAgg,
  ] = await Promise.all([
    prisma.content.groupBy({ by: ["type"], _count: { id: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        userEmail: true,
        userName: true,
        role: true,
        eventType: true,
        ipAddress: true,
        deviceType: true,
        createdAt: true,
      },
    }),
    prisma.musicTrack.count(),
    prisma.syncDeal.count(),
    prisma.user.count({ where: { isAfdaStudent: true } }),
    prisma.crewTeam.count(),
    prisma.crewTeamMember.count(),
    prisma.crewTeamRequest.count(),
    prisma.castingAgency.count(),
    prisma.castingTalent.count(),
    prisma.castingInquiry.count(),
    prisma.auditionPost.count(),
    prisma.$queryRaw<IpAggRow[]>(Prisma.sql`
      SELECT
        a."ipAddress" AS "ipAddress",
        COUNT(*)::bigint AS count,
        MAX(a."createdAt") AS "lastSeen",
        MAX(COALESCE(a."userName", a."userEmail", 'Unknown')) AS "userSample"
      FROM "ActivityLog" a
      WHERE a."ipAddress" IS NOT NULL
        AND a."createdAt" >= ${telemetrySince}
      GROUP BY a."ipAddress"
      ORDER BY count DESC
      LIMIT 150
    `),
    prisma.$queryRaw<DeviceAggRow[]>(Prisma.sql`
      SELECT a."deviceType" AS "deviceType", COUNT(*)::bigint AS count
      FROM "ActivityLog" a
      WHERE a."deviceType" IS NOT NULL
        AND a."createdAt" >= ${telemetrySince}
      GROUP BY a."deviceType"
      ORDER BY count DESC
    `),
    prisma.$queryRaw<SignInRoleRow[]>(Prisma.sql`
      SELECT a."role" AS "role", COUNT(*)::bigint AS count
      FROM "ActivityLog" a
      WHERE a."eventType" = 'SIGN_IN'
        AND a."createdAt" >= ${telemetrySince}
      GROUP BY a."role"
    `),
    prisma.$queryRaw<WatchAggRow[]>(Prisma.sql`
      SELECT
        COUNT(DISTINCT "userId")::bigint AS "distinctUsers",
        COALESCE(SUM("durationSeconds"), 0)::bigint AS "totalSeconds"
      FROM "WatchSession"
      WHERE "startedAt" >= ${periodStart}
        AND "startedAt" <= ${periodEnd}
    `),
  ]);

  const ipAddresses: Record<string, { count: number; lastSeen: string; users: string[] }> = {};
  for (const row of ipRows) {
    const ip = row.ipAddress;
    if (!ip) continue;
    const sample = row.userSample?.trim() || "Unknown";
    ipAddresses[ip] = {
      count: Number(row.count),
      lastSeen: row.lastSeen.toISOString(),
      users: [sample],
    };
  }

  const deviceBreakdown: Record<string, number> = {};
  for (const row of deviceRows) {
    if (row.deviceType) deviceBreakdown[row.deviceType] = Number(row.count);
  }

  const signInsByRole: Record<string, number> = {};
  for (const row of signInRoleRows) {
    signInsByRole[row.role] = Number(row.count);
  }

  const wa = watchAgg[0];
  const watcherCount = wa ? Number(wa.distinctUsers) : 0;
  const totalSecondsInPeriod = wa ? Number(wa.totalSeconds ?? 0) : 0;
  const avgWatchTime =
    watcherCount > 0 ? Math.round(totalSecondsInPeriod / watcherCount) : 0;

  return NextResponse.json({
    ...stats,
    contentByType,
    usersByRole,
    recentActivity,
    totalTracks,
    totalSyncDeals,
    afdaStudents,
    crewTeamCount,
    crewTotalMembers,
    crewRequestCount,
    castingAgencyCount,
    castTotalTalent,
    castInquiryCount,
    auditionCount,
    ipAddresses,
    deviceBreakdown,
    signInsByRole,
    avgWatchTimePerUser: avgWatchTime,
    uniqueWatchers: watcherCount,
    telemetrySince: telemetrySince.toISOString(),
  });
}
