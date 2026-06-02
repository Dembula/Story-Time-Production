import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgencyForUser, requireCastingAgencySession } from "@/lib/casting-agency";
import { handleCastingAgencyApiError } from "@/lib/casting-agency-errors";

export async function GET() {
  try {
  const auth = await requireCastingAgencySession();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const agency = await getAgencyForUser(auth.session.userId);
  if (!agency) return NextResponse.json({ error: "Create agency profile first" }, { status: 404 });

  const [inquiries, invitations, contracts] = await Promise.all([
    prisma.castingInquiry.findMany({
      where: { agencyId: agency.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { creator: { select: { id: true, name: true } } },
    }),
    prisma.castingInvitation.findMany({
      where: { castingAgencyId: agency.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        talent: { select: { id: true, name: true } },
        role: { select: { name: true } },
        project: { select: { id: true, title: true } },
        creator: { select: { id: true, name: true } },
      },
    }),
    prisma.projectContract.findMany({
      where: { castingTalent: { castingAgencyId: agency.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        project: { select: { id: true, title: true } },
        castingTalent: { select: { id: true, name: true } },
        versions: { orderBy: { version: "desc" }, take: 1 },
      },
    }),
  ]);

  const pipeline = [
    ...inquiries.map((row) => ({
      id: row.id,
      kind: "INQUIRY" as const,
      title: row.projectName || "Casting inquiry",
      subtitle: [row.roleName, row.creator?.name].filter(Boolean).join(" · "),
      status: row.status,
      talentName: null as string | null,
      createdAt: row.createdAt.toISOString(),
      href: `/casting-agency/inquiries`,
    })),
    ...invitations.map((row) => ({
      id: row.id,
      kind: "INVITATION" as const,
      title: row.project?.title || "Project invitation",
      subtitle: [row.role.name, row.creator?.name].filter(Boolean).join(" · "),
      status: row.status,
      talentName: row.talent?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      href: `/casting-agency/invitations`,
    })),
    ...contracts.map((row) => ({
      id: row.id,
      kind: "CONTRACT" as const,
      title: row.project?.title || "Platform contract",
      subtitle: [row.type, row.castingTalent?.name].filter(Boolean).join(" · "),
      status: row.status,
      talentName: row.castingTalent?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      href: `/casting-agency/contracts`,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    summary: {
      inquiries: inquiries.length,
      invitations: invitations.length,
      contracts: contracts.length,
      pendingInquiries: inquiries.filter((i) => i.status === "PENDING").length,
      pendingInvitations: invitations.filter((i) => i.status === "PENDING").length,
      signedContracts: contracts.filter((c) => c.status === "SIGNED" || c.status === "ACTIVE").length,
    },
    pipeline,
  });
  } catch (error) {
    const { message, status } = handleCastingAgencyApiError(error, "Unable to load deal pipeline.");
    return NextResponse.json({ error: message }, { status });
  }
}
