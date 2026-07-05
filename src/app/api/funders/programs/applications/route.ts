import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/funders";
import { syncApprovedProgramApplicationToFundingHub } from "@/lib/funding-application-source-sync";
export async function GET(req: NextRequest) {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (access.role !== "FUNDER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await prisma.funderProfile.findUnique({ where: { userId: access.userId! } });
  if (!profile) return NextResponse.json({ applications: [] });

  const programId = req.nextUrl.searchParams.get("programId");
  const applications = await prisma.fundingProgramApplication.findMany({
    where: {
      program: { funderProfileId: profile.id },
      ...(programId ? { programId } : {}),
    },
    include: {
      program: { select: { id: true, title: true } },
      project: { select: { id: true, title: true, genre: true, logline: true } },
      creatorUser: { select: { id: true, name: true, professionalName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    applications: applications.map((a) => ({
      id: a.id,
      programId: a.programId,
      programTitle: a.program.title,
      projectId: a.projectId,
      projectTitle: a.project.title,
      projectGenre: a.project.genre,
      projectLogline: a.project.logline,
      creatorName: a.creatorUser.professionalName || a.creatorUser.name,
      creatorEmail: a.creatorUser.email,
      requestedAmount: a.requestedAmount,
      notes: a.notes,
      documentFlags: a.documentFlags,
      status: a.status,
      adminNote: a.adminNote,
      submittedAt: a.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const access = await requireSessionUser();
  if (access.error) return access.error;
  if (access.role !== "FUNDER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profile = await prisma.funderProfile.findUnique({ where: { userId: access.userId! } });
  if (!profile) return NextResponse.json({ error: "Funder profile not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    status?: string;
    adminNote?: string | null;
  } | null;
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.fundingProgramApplication.findFirst({
    where: { id: body.id, program: { funderProfileId: profile.id } },
    include: { program: true, project: true },
  });
  if (!existing) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const nextStatus = body.status ?? existing.status;
  const application = await prisma.fundingProgramApplication.update({
    where: { id: existing.id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.adminNote !== undefined ? { adminNote: body.adminNote?.trim() || null } : {}),
    },
  });

  if (nextStatus === "APPROVED" && profile.userId) {
    const existingDeal = await prisma.investmentDeal.findFirst({
      where: {
        projectId: existing.projectId,
        funderUserId: profile.userId,
        creatorUserId: existing.creatorUserId,
        pipelineStatus: { not: "REJECTED" },
      },
    });
    if (!existingDeal) {
      let opportunity = await prisma.investmentOpportunity.findFirst({
        where: { projectId: existing.projectId, createdByUserId: existing.creatorUserId, status: "OPEN" },
      });
      if (!opportunity) {
        opportunity = await prisma.investmentOpportunity.create({
          data: {
            projectId: existing.projectId,
            createdByUserId: existing.creatorUserId,
            type: "FILM_PROJECT",
            marketCategory: "FILM_PROJECT",
            title: `${existing.project.title} — program application`,
            description: existing.notes,
            fundingTarget: existing.requestedAmount ?? 0,
            status: "OPEN",
            visible: false,
          },
        });
      }
      await prisma.investmentDeal.create({
        data: {
          opportunityId: opportunity.id,
          projectId: existing.projectId,
          creatorUserId: existing.creatorUserId,
          funderUserId: profile.userId,
          pipelineStatus: "INTERESTED",
        },
      });
    }
  }

  if (nextStatus === "APPROVED") {
    await syncApprovedProgramApplicationToFundingHub(application.id).catch(() => {});
  }

  return NextResponse.json({ application });
}
