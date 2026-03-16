import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const periodId = req.url.includes("?") ? new URL(req.url).searchParams.get("periodId") : null;
  let period = null;
  if (periodId) {
    period = await prisma.competitionPeriod.findUnique({ where: { id: periodId } });
  } else {
    period = await prisma.competitionPeriod.findFirst({ where: { status: "OPEN" }, orderBy: { endDate: "desc" } })
      ?? await prisma.competitionPeriod.findFirst({ orderBy: { endDate: "desc" } });
  }

  if (!period) return NextResponse.json({ period: null, leaderboard: [], votes: [] });

  const votes = await prisma.creatorVote.groupBy({
    by: ["creatorId"],
    where: { competitionPeriodId: period.id },
    _count: { id: true },
  });

  const creatorIds = votes.map((v) => v.creatorId);
  const creators = await prisma.user.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, name: true, email: true },
  });
  const creatorMap = Object.fromEntries(creators.map((c) => [c.id, c]));

  const leaderboard = votes
    .map((v) => ({ rank: 0, creatorId: v.creatorId, creatorName: creatorMap[v.creatorId]?.name ?? "Unknown", creatorEmail: creatorMap[v.creatorId]?.email, voteCount: v._count.id }))
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, 100)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const allVotes = await prisma.creatorVote.findMany({
    where: { competitionPeriodId: period.id },
    include: { voter: { select: { email: true, name: true } }, creator: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ period: { id: period.id, name: period.name, status: period.status, winnerId: period.winnerId }, leaderboard, votes: allVotes });
}
