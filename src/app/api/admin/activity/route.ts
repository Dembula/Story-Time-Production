import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [activity, byRole, totalWatch, totalComments, totalRatings] = await Promise.all([
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, userName: true, userEmail: true, role: true, eventType: true, ipAddress: true, deviceType: true, createdAt: true },
      }),
      prisma.activityLog.groupBy({ by: ["role"], where: { eventType: "SIGN_IN" }, _count: { id: true } }),
      prisma.watchSession.aggregate({ _sum: { durationSeconds: true } }),
      prisma.comment.count(),
      prisma.rating.count(),
    ]);

    const ipBreakdown: Record<string, { count: number; users: string[] }> = {};
    const deviceBreakdown: Record<string, number> = {};
    const hourlyDistribution: Record<string, number> = {};

    for (const a of activity) {
      if (a.ipAddress) {
        if (!ipBreakdown[a.ipAddress]) ipBreakdown[a.ipAddress] = { count: 0, users: [] };
        ipBreakdown[a.ipAddress].count++;
        const uName = a.userName || a.userEmail || "Unknown";
        if (!ipBreakdown[a.ipAddress].users.includes(uName)) ipBreakdown[a.ipAddress].users.push(uName);
      }
      if (a.deviceType) deviceBreakdown[a.deviceType] = (deviceBreakdown[a.deviceType] || 0) + 1;
      const hour = new Date(a.createdAt).getHours().toString();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
    }

    return NextResponse.json({
      activity,
      signInsByRole: byRole,
      totalWatchTimeSeconds: totalWatch._sum.durationSeconds ?? 0,
      totalComments,
      totalRatings,
      uniqueIPs: Object.keys(ipBreakdown).length,
      deviceBreakdown,
      ipBreakdown,
      hourlyDistribution,
    });
  } catch (error) {
    console.error("Error in /api/admin/activity", error);
    return NextResponse.json({ error: "Failed to load admin activity" }, { status: 500 });
  }
}
