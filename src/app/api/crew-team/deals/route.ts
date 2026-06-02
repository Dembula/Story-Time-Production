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

    const [requests, invitations] = await Promise.all([
      prisma.crewTeamRequest.findMany({
        where: { crewTeamId: team.id },
        orderBy: { createdAt: "desc" },
        take: 40,
        include: { creator: { select: { name: true } } },
      }),
      prisma.crewInvitation.findMany({
        where: { crewTeamId: team.id },
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          project: { select: { title: true } },
          need: { select: { role: true, department: true } },
          crewMember: { select: { name: true, photoUrl: true } },
        },
      }),
    ]);

    const pipeline = [
      ...requests.map((r) => ({
        id: r.id,
        kind: "CREW_REQUEST" as const,
        title: r.projectName || "Crew booking request",
        subtitle: r.creator?.name ?? "Creator",
        status: r.status,
        previewImageUrl: null as string | null,
        createdAt: r.createdAt.toISOString(),
        href: `/crew-team/requests`,
        paid: Boolean(r.paymentTransactionId),
      })),
      ...invitations.map((i) => ({
        id: i.id,
        kind: "PROJECT_INVITATION" as const,
        title: i.project?.title || "Project invitation",
        subtitle: [i.need?.role, i.crewMember?.name].filter(Boolean).join(" · "),
        status: i.status,
        previewImageUrl: i.crewMember?.photoUrl ?? null,
        createdAt: i.createdAt.toISOString(),
        href: `/crew-team/invitations`,
        paid: false,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      summary: {
        requests: requests.length,
        invitations: invitations.length,
        pendingRequests: requests.filter((r) => r.status === "PENDING").length,
        pendingInvitations: invitations.filter((i) => i.status === "PENDING").length,
      },
      pipeline,
    });
  } catch (error) {
    const { message, status } = handleCompanyOpsApiError(error, "Unable to load deal pipeline.");
    return NextResponse.json({ error: message }, { status });
  }
}
