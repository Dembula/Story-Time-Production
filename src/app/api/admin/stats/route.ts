import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlatformStats } from "@/lib/revenue";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date();

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
  ] = await Promise.all([
    prisma.content.groupBy({ by: ["type"], _count: { id: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
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
  ]);

  const ipAddresses = recentActivity
    .filter((a) => a.ipAddress)
    .reduce<Record<string, { count: number; lastSeen: Date; users: string[] }>>((acc, a) => {
      const ip = a.ipAddress!;
      if (!acc[ip]) acc[ip] = { count: 0, lastSeen: a.createdAt, users: [] };
      acc[ip].count++;
      if (!acc[ip].users.includes(a.userName || a.userEmail || "Unknown")) {
        acc[ip].users.push(a.userName || a.userEmail || "Unknown");
      }
      return acc;
    }, {});

  const deviceBreakdown = recentActivity
    .filter((a) => a.deviceType)
    .reduce<Record<string, number>>((acc, d) => {
      const device = d.deviceType!;
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {});

  const signInsByRole = recentActivity
    .filter((a) => a.eventType === "SIGN_IN")
    .reduce<Record<string, number>>((acc, a) => {
      acc[a.role] = (acc[a.role] || 0) + 1;
      return acc;
    }, {});

  const allSessions = await prisma.watchSession.findMany({
    select: { userId: true, durationSeconds: true },
  });
  const userWatchTotals: Record<string, number> = {};
  for (const ws of allSessions) {
    userWatchTotals[ws.userId] = (userWatchTotals[ws.userId] || 0) + ws.durationSeconds;
  }
  const watcherCount = Object.keys(userWatchTotals).length;
  const avgWatchTime = watcherCount > 0
    ? Math.round(Object.values(userWatchTotals).reduce((a, b) => a + b, 0) / watcherCount)
    : 0;

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
  });
}
