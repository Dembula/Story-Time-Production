import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const [funders, project] = await Promise.all([
    prisma.funderProfile.findMany({
      where: {
        verificationStatus: { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
        limitedAccessEnabled: true,
      },
      include: {
        user: { select: { id: true, name: true, professionalName: true, headline: true } },
      },
      orderBy: [{ verificationStatus: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    prisma.originalProject.findUnique({
      where: { id: projectId },
      include: {
        scripts: { select: { id: true, title: true } },
        projectBudget: { include: { lines: true } },
        castingRoles: { select: { id: true } },
        crewRoleNeeds: { select: { id: true } },
      },
    }),
  ]);

  return NextResponse.json({ funders, project });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        funderUserId?: string;
        opportunityId?: string;
        message?: string;
      }
    | null;
  if (!body?.funderUserId && !body?.opportunityId) {
    return NextResponse.json({ error: "funderUserId or opportunityId is required." }, { status: 400 });
  }

  let opportunityId = body.opportunityId ?? null;
  if (!opportunityId) {
    const opportunity = await prisma.investmentOpportunity.create({
      data: {
        projectId,
        createdByUserId: access.userId!,
        type: "FILM_PROJECT",
        marketCategory: "FILM_PROJECT",
        title: `${access.project?.title ?? "Project"} funding round`,
        description: body.message?.trim() || "Funding request submitted from Creator Funding Hub.",
        fundingTarget: Number(access.project?.budget ?? 0) || 1,
        status: "OPEN",
      },
    });
    opportunityId = opportunity.id;
  }

  const deal = await prisma.investmentDeal.create({
    data: {
      opportunityId,
      projectId,
      creatorUserId: access.userId!,
      funderUserId: body.funderUserId!,
      pipelineStatus: "INTERESTED",
      negotiationMessages: {
        create: body.message?.trim()
          ? [{ senderId: access.userId!, message: body.message.trim(), messageType: "TEXT" }]
          : [],
      },
    },
  });

  return NextResponse.json({ deal }, { status: 201 });
}
