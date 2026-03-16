import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const adminId = (session?.user as { id?: string })?.id;
  if (role !== "ADMIN" || !adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { creatorId } = body as { creatorId?: string };
  if (!creatorId) return NextResponse.json({ error: "creatorId required" }, { status: 400 });

  const period = await prisma.competitionPeriod.findFirst({
    where: { status: "OPEN" },
    orderBy: { endDate: "desc" },
  });
  if (!period) return NextResponse.json({ error: "No open period" }, { status: 400 });

  const updated = await prisma.competitionPeriod.update({
    where: { id: period.id },
    data: { winnerId: creatorId, status: "CLOSED" },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: adminId,
      action: "COMPETITION_WINNER_SET",
      entityType: "CompetitionPeriod",
      entityId: updated.id,
      oldValue: { previousWinnerId: period.winnerId, previousStatus: period.status },
      newValue: { winnerId: updated.winnerId, status: updated.status },
    },
  });

  return NextResponse.json({ success: true });
}
