import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleCompanyOpsApiError } from "@/lib/casting-agency-errors";
import { requireCompanySession } from "@/lib/company-ops";

export async function GET() {
  try {
    const auth = await requireCompanySession(["CREW_TEAM", "ADMIN"]);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const team = await prisma.crewTeam.findUnique({ where: { userId: auth.userId } });
    if (!team) return NextResponse.json({ error: "Create crew team profile first" }, { status: 404 });

    const invitations = await prisma.crewInvitation.findMany({
      where: { crewTeamId: team.id },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { title: true } },
        need: { select: { role: true, department: true } },
        crewMember: { select: { name: true, photoUrl: true } },
        creator: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json(invitations);
  } catch (error) {
    const { message, status } = handleCompanyOpsApiError(error, "Unable to load invitations.");
    return NextResponse.json({ error: message }, { status });
  }
}
