import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseEmbeddedMeta, type ActorMarketMeta } from "@/lib/marketplace-profile-meta";

const ACQUISITION_FEE = 19.99;
const ROLE_LINK_MARKER_PREFIX = "castingRoleId:";

async function ensureCreatorForProject(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null as string | null };
  }
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });
  if (!project) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null as string | null };
  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);
  if (!isCreatorMember) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null as string | null };
  return { error: null as NextResponse | null, userId, email: session.user?.email ?? null };
}

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureCreatorForProject(projectId);
  if (access.error) return access.error;
  const userId = access.userId!;

  const body = (await req.json().catch(() => null)) as
    | { invitationId?: string; salaryAmount?: number | null; salaryNotes?: string | null }
    | null;
  if (!body?.invitationId) {
    return NextResponse.json({ error: "Missing invitationId" }, { status: 400 });
  }

  const invitation = await prisma.castingInvitation.findFirst({
    where: { id: body.invitationId, projectId },
    include: { role: true, castingAgency: true, talent: true, project: true },
  });
  if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  if (invitation.status !== "ACCEPTED") {
    return NextResponse.json({ error: "Invitation must be accepted first" }, { status: 400 });
  }
  if (!invitation.talent) {
    return NextResponse.json({ error: "Accepted invitation has no talent linked" }, { status: 400 });
  }
  const talent = invitation.talent;
  const parsedTalentMeta = parseEmbeddedMeta<ActorMarketMeta>(talent.bio);

  const marker = `${ROLE_LINK_MARKER_PREFIX}${invitation.roleId}`;
  const fallbackRate = Number(parsedTalentMeta.meta?.dailyRate ?? 0);
  const amount = Math.max(0, Number(body.salaryAmount ?? fallbackRate));

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.paymentRecord.create({
      data: {
        userId,
        provider: "DISABLED",
        purpose: "CASTING_ACQUISITION_FEE",
        status: "SUCCEEDED",
        amount: ACQUISITION_FEE,
        currency: "ZAR",
        email: access.email,
        paidAt: new Date(),
        metadata: {
          kind: "CASTING_ACQUISITION_FEE",
          invitationId: invitation.id,
          roleId: invitation.roleId,
          talentId: invitation.talentId,
          castingAgencyId: invitation.castingAgencyId,
          projectId,
        } as any,
      },
    });

    await tx.castingRole.update({
      where: { id: invitation.roleId },
      data: { status: "CAST" },
    });
    if (!invitation.role.breakdownCharacterId) {
      const match = await tx.breakdownCharacter.findFirst({
        where: { projectId, name: { equals: invitation.role.name, mode: "insensitive" } },
        select: { id: true },
      });
      if (match) {
        await tx.castingRole.update({
          where: { id: invitation.roleId },
          data: { breakdownCharacterId: match.id },
        });
      }
    }

    const budget = await tx.projectBudget.upsert({
      where: { projectId },
      create: { projectId, template: "SHORT_FILM", currency: "ZAR", totalPlanned: 0 },
      update: {},
    });
    const existingLine = await tx.projectBudgetLine.findFirst({
      where: { budgetId: budget.id, notes: { contains: marker } },
    });
    const notesWithMarker = `${body.salaryNotes ?? ""}\n[${marker}]`.trim();
    if (existingLine) {
      await tx.projectBudgetLine.update({
        where: { id: existingLine.id },
        data: {
          department: "CAST",
          name: `Salary · ${invitation.role.name}`,
          quantity: 1,
          unitCost: amount,
          total: amount,
          notes: notesWithMarker,
        },
      });
    } else {
      await tx.projectBudgetLine.create({
        data: {
          budgetId: budget.id,
          department: "CAST",
          name: `Salary · ${invitation.role.name}`,
          quantity: 1,
          unitCost: amount,
          total: amount,
          notes: notesWithMarker,
        },
      });
    }

    const existingRoster = await tx.creatorCastRoster.findFirst({
      where: { creatorId: userId, notes: { contains: marker } },
    });
    if (existingRoster) {
      await tx.creatorCastRoster.update({
        where: { id: existingRoster.id },
        data: {
          name: talent.name,
          roleType: "Actor",
          notes: `Linked from ${invitation.castingAgency?.agencyName ?? "agency"}.\n[${marker}]`,
          pastWork: talent.pastWork ?? null,
        },
      });
    } else {
      await tx.creatorCastRoster.create({
        data: {
          creatorId: userId,
          name: talent.name,
          roleType: "Actor",
          notes: `Linked from ${invitation.castingAgency?.agencyName ?? "agency"}.\n[${marker}]`,
          pastWork: talent.pastWork ?? parsedTalentMeta.plain ?? null,
          contactEmail: talent.contactEmail ?? null,
        },
      });
    }

    const existingContract = await tx.projectContract.findFirst({
      where: { projectId, type: "ACTOR", castingTalentId: talent.id },
    });
    if (!existingContract) {
      const contract = await tx.projectContract.create({
        data: {
          projectId,
          type: "ACTOR",
          status: "DRAFT",
          subject: `Actor contract – ${talent.name}`,
          castingTalentId: talent.id,
          createdById: userId,
        },
      });
      const terms = `Role: ${invitation.role.name}\nSalary (planned): R${amount.toFixed(
        2,
      )}\nAgency: ${invitation.castingAgency?.agencyName ?? "N/A"}\n\nFinal terms to be signed by all parties.`;
      const version = await tx.projectContractVersion.create({
        data: { contractId: contract.id, version: 1, terms, createdById: userId },
      });
      await tx.projectContract.update({
        where: { id: contract.id },
        data: { currentVersionId: version.id },
      });
    }

    return { paymentId: payment.id };
  });

  return NextResponse.json({
    ok: true,
    acquisitionFee: ACQUISITION_FEE,
    paymentId: result.paymentId,
  });
}
