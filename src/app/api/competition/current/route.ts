import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const period = await prisma.competitionPeriod.findFirst({
    where: { status: "OPEN", startDate: { lte: now }, endDate: { gte: now } },
    orderBy: { endDate: "desc" },
    include: { winner: { select: { id: true, name: true } } },
  });

  if (!period) {
    return NextResponse.json({ period: null, leaderboard: [], message: "No active competition" });
  }

  const votes = await prisma.creatorVote.groupBy({
    by: ["creatorId"],
    where: { competitionPeriodId: period.id },
    _count: { id: true },
  });

  const creatorIds = votes.map((v) => v.creatorId);
  const creators = await prisma.user.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, name: true },
  });
  const creatorMap = Object.fromEntries(creators.map((c) => [c.id, c]));

  const leaderboard = votes
    .map((v) => ({ creatorId: v.creatorId, creatorName: creatorMap[v.creatorId]?.name ?? "Unknown", voteCount: v._count.id }))
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, 5);

  return NextResponse.json({ period: { id: period.id, name: period.name, startDate: period.startDate, endDate: period.endDate, winnerId: period.winnerId, winner: period.winner }, leaderboard });
}
