import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [teams, requestCount, teamCount] = await Promise.all([
    prisma.crewTeam.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, requests: true } },
      },
    }),
    prisma.crewTeamRequest.count(),
    prisma.crewTeam.count(),
  ]);

  const totalMembers = teams.reduce((acc, t) => acc + t._count.members, 0);
  const pendingRequests = await prisma.crewTeamRequest.count({ where: { status: "PENDING" } });

  return NextResponse.json({
    teams,
    teamCount,
    totalMembers,
    requestCount,
    pendingRequests,
  });
}
