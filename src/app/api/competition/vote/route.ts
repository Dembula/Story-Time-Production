import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "SUBSCRIBER") return NextResponse.json({ error: "Only subscribers can vote" }, { status: 403 });

  const body = await req.json();
  const { creatorId } = body as { creatorId?: string };
  if (!creatorId) return NextResponse.json({ error: "creatorId required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const now = new Date();
  const period = await prisma.competitionPeriod.findFirst({
    where: {
      status: "OPEN",
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { endDate: "desc" },
  });
  if (!period) return NextResponse.json({ error: "No active competition" }, { status: 400 });

  const creator = await prisma.user.findUnique({ where: { id: creatorId, role: "CONTENT_CREATOR" } });
  if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  await prisma.creatorVote.upsert({
    where: { voterId_competitionPeriodId: { voterId: user.id, competitionPeriodId: period.id } },
    create: { voterId: user.id, creatorId, competitionPeriodId: period.id },
    update: { creatorId },
  });

  return NextResponse.json({ success: true });
}
