import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleCompanyOpsApiError } from "@/lib/casting-agency-errors";
import { requireCompanySession } from "@/lib/company-ops";
import { MARKETPLACE_TRANSACTION_TYPE, sumPayeeCompletedAmount } from "@/lib/financial-ledger";

export async function GET() {
  try {
    const auth = await requireCompanySession(["CREW_TEAM", "ADMIN"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const team = await prisma.crewTeam.findUnique({
      where: { userId: auth.userId },
      include: {
        _count: { select: { members: true, requests: true, crewInvitations: true } },
        members: { orderBy: { sortOrder: "asc" }, take: 6, select: { id: true, name: true, role: true, photoUrl: true, department: true } },
        requests: {
          orderBy: { createdAt: "desc" },
          take: 6,
          include: { creator: { select: { name: true } } },
        },
      },
    });

    if (!team) return NextResponse.json({ error: "Create crew team profile first" }, { status: 404 });

    const revenue = await sumPayeeCompletedAmount(auth.userId, MARKETPLACE_TRANSACTION_TYPE.CREW_REQUEST);
    const pendingInvites = await prisma.crewInvitation.count({
      where: { crewTeamId: team.id, status: "PENDING" },
    });

    return NextResponse.json({
      team: { id: team.id, companyName: team.companyName, tagline: team.tagline, counts: team._count },
      metrics: {
        members: team._count.members,
        requests: team._count.requests,
        pendingRequests: team.requests.filter((r) => r.status === "PENDING").length,
        pendingInvitations: pendingInvites,
        revenue,
      },
      recentRequests: team.requests,
      rosterPreview: team.members,
    });
  } catch (error) {
    const { message, status } = handleCompanyOpsApiError(error, "Unable to load crew overview.");
    return NextResponse.json({ error: message }, { status });
  }
}
