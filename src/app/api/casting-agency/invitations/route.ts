import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CASTING_AGENCY" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id;

  const agency = await prisma.castingAgency.findUnique({ where: { userId: userId! } });
  if (!agency) return NextResponse.json([]);

  const invitations = await prisma.castingInvitation.findMany({
    where: { castingAgencyId: agency.id },
    orderBy: { createdAt: "desc" },
    include: {
      role: { select: { id: true, name: true, projectId: true } },
      project: { select: { id: true, title: true } },
      talent: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(invitations);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CASTING_AGENCY" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const userId = (session.user as { id?: string })?.id;

  const agency = await prisma.castingAgency.findUnique({ where: { userId: userId! } });
  if (!agency) return NextResponse.json({ error: "Agency not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        status: "ACCEPTED" | "DECLINED";
        response?: string | null;
      }
    | null;

  if (!body?.id || !body.status) {
    return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
  }

  const invitation = await prisma.castingInvitation.findFirst({
    where: { id: body.id, castingAgencyId: agency.id },
    include: {
      project: true,
      role: true,
      talent: true,
      creator: true,
    },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const updated = await prisma.castingInvitation.update({
    where: { id: invitation.id },
    data: {
      status: body.status,
      response: body.response ?? null,
      respondedAt: new Date(),
    },
  });

  // If accepted, optionally add to creator's cast roster for convenience
  if (body.status === "ACCEPTED" && invitation.talent && invitation.creator) {
    await prisma.creatorCastRoster.create({
      data: {
        creatorId: invitation.creator.id,
        name: invitation.talent.name,
        roleType: "Actor",
        contactEmail: null,
        notes: `Confirmed via ${agency.agencyName} for role "${invitation.role?.name ?? ""}" on project "${invitation.project?.title ?? ""}".`,
        pastWork: invitation.talent.pastWork ?? null,
      },
    });

    // Also ensure there is a draft actor contract for this talent & project
    if (invitation.project) {
      const existing = await prisma.projectContract.findFirst({
        where: {
          projectId: invitation.project.id,
          castingTalentId: invitation.talent.id,
          type: "ACTOR",
        },
        include: { currentVersion: true },
      });

      if (!existing) {
        const baseTerms = `Actor engagement for "${invitation.project.title ?? "Project"}" in the role "${
          invitation.role?.name ?? ""
        }". Terms to be finalized between producer and agency.`;

        const contract = await prisma.projectContract.create({
          data: {
            projectId: invitation.project.id,
            type: "ACTOR",
            status: "DRAFT",
            subject: `Actor contract – ${invitation.talent.name}`,
            castingTalentId: invitation.talent.id,
            createdById: invitation.creator.id,
          },
        });

        const version = await prisma.projectContractVersion.create({
          data: {
            contractId: contract.id,
            version: 1,
            terms: baseTerms,
            createdById: invitation.creator.id,
          },
        });

        await prisma.projectContract.update({
          where: { id: contract.id },
          data: { currentVersionId: version.id },
        });
      }
    }
  }

  return NextResponse.json(updated);
}

