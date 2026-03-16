import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const creatorId = (session.user as { id?: string })?.id ?? req.nextUrl.searchParams.get("creatorId");
  if (!creatorId) return NextResponse.json({ error: "creatorId required" }, { status: 400 });

  const period = await prisma.competitionPeriod.findFirst({
    where: { status: "OPEN" },
    orderBy: { endDate: "desc" },
  });
  if (!period) return NextResponse.json({ period: null, rank: 0, voteCount: 0, voters: [] });

  const votes = await prisma.creatorVote.groupBy({
    by: ["creatorId"],
    where: { competitionPeriodId: period.id },
    _count: { id: true },
  });
  const sorted = votes.sort((a, b) => b._count.id - a._count.id);
  const rank = sorted.findIndex((v) => v.creatorId === creatorId) + 1 || 0;
  const myVotes = await prisma.creatorVote.findMany({
    where: { competitionPeriodId: period.id, creatorId },
    include: { voter: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  const voteCount = myVotes.length;

  return NextResponse.json({
    period: { id: period.id, name: period.name, endDate: period.endDate },
    rank: rank || null,
    voteCount,
    voters: myVotes.map((v) => ({ name: v.voter.name || v.voter.email, at: v.createdAt })),
  });
}
