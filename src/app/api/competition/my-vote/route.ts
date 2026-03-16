import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ vote: null });

  const period = await prisma.competitionPeriod.findFirst({
    where: { status: "OPEN" },
    orderBy: { endDate: "desc" },
  });
  if (!period) return NextResponse.json({ vote: null });

  const vote = await prisma.creatorVote.findUnique({
    where: { voterId_competitionPeriodId: { voterId: user.id, competitionPeriodId: period.id } },
    include: { creator: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ vote: vote ? { creatorId: vote.creatorId, creatorName: vote.creator.name } : null, period: { id: period.id, name: period.name } });
}
