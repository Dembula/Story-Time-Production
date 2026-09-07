import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [teams, requestCount, teamCount, pendingRequests] = await Promise.all([
    prisma.crewTeam.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, requests: true, crewInvitations: true } },
        requests: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.crewTeamRequest.count(),
    prisma.crewTeam.count(),
    prisma.crewTeamRequest.count({ where: { status: "PENDING" } }),
  ]);

  const totalMembers = teams.reduce((acc, t) => acc + t._count.members, 0);

  return NextResponse.json({
    teams: teams.map((t) => ({
      id: t.id,
      companyName: t.companyName,
      tagline: t.tagline,
      description: t.description,
      city: t.city,
      country: t.country,
      user: t.user,
      _count: t._count,
      lastActivityAt: t.requests[0]?.createdAt?.toISOString() || t.updatedAt.toISOString(),
    })),
    teamCount,
    totalMembers,
    requestCount,
    pendingRequests,
  });
}
