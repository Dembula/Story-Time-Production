import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession } from "@/lib/meet/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summaries = await prisma.meetSummary.findMany({
    where: {
      OR: [
        { createdByUserId: session.userId },
        { meeting: { hostUserId: session.userId } },
        { meeting: { participants: { some: { userId: session.userId } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      meeting: { select: { id: true, code: true, title: true, endedAt: true } },
    },
  });

  return NextResponse.json({ summaries });
}
