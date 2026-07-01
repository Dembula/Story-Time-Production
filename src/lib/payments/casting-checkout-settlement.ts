import { prisma } from "@/lib/prisma";
import { ensureDefaultProjectBudgetInTx } from "@/lib/project-budget-access";
import { AUDITION_LISTING_FEE_ZAR } from "@/lib/pricing";

const ROLE_LINK_MARKER_PREFIX = "castingRoleId:";

export async function finalizeCastingRoleListingPayment(paymentRecord: {
  id: string;
  userId: string | null;
  relatedEntityId: string | null;
  metadata: unknown;
}) {
  const meta =
    paymentRecord.metadata && typeof paymentRecord.metadata === "object"
      ? (paymentRecord.metadata as Record<string, unknown>)
      : {};
  const roleId = paymentRecord.relatedEntityId ?? (typeof meta.roleId === "string" ? meta.roleId : null);
  const projectId = typeof meta.projectId === "string" ? meta.projectId : null;
  const creatorId = paymentRecord.userId ?? (typeof meta.creatorId === "string" ? meta.creatorId : null);
  if (!roleId || !projectId || !creatorId) return;

  const existing = await prisma.castingInvitation.findFirst({
    where: { roleId, creatorId, message: { contains: `Listing fee paid` } },
    select: { id: true },
  });
  if (existing) return;

  const role = await prisma.castingRole.findFirst({
    where: { id: roleId, projectId },
    select: { id: true, name: true },
  });
  if (!role) return;

  const agencies = await prisma.castingAgency.findMany({ select: { id: true } });
  if (agencies.length === 0) return;

  const scheduledAt = typeof meta.scheduledAt === "string" ? meta.scheduledAt : null;
  const details = typeof meta.details === "string" ? meta.details : null;
  const msgParts = [
    `Audition listing for role "${role.name}".`,
    scheduledAt ? `Scheduled: ${scheduledAt}` : null,
    details ? `Details: ${details}` : null,
    `Listing fee paid: R${AUDITION_LISTING_FEE_ZAR.toFixed(2)}.`,
  ].filter(Boolean);

  await prisma.$transaction(
    agencies.map((agency) =>
      prisma.castingInvitation.create({
        data: {
          projectId,
          roleId: role.id,
          creatorId,
          castingAgencyId: agency.id,
          message: msgParts.join(" "),
          status: "PENDING",
        },
      }),
    ),
  );
}

export async function finalizeCastingHirePayment(paymentRecord: {
  id: string;
  userId: string | null;
  relatedEntityId: string | null;
  metadata: unknown;
}) {
  const meta =
    paymentRecord.metadata && typeof paymentRecord.metadata === "object"
      ? (paymentRecord.metadata as Record<string, unknown>)
      : {};
  const invitationId = paymentRecord.relatedEntityId ?? (typeof meta.invitationId === "string" ? meta.invitationId : null);
  const projectId = typeof meta.projectId === "string" ? meta.projectId : null;
  const userId = paymentRecord.userId;
  if (!invitationId || !projectId || !userId) return;

  const invitation = await prisma.castingInvitation.findFirst({
    where: { id: invitationId, projectId },
    include: { role: true, castingAgency: true, talent: true, project: true },
  });
  if (!invitation || invitation.status !== "ACCEPTED" || !invitation.talent) return;

  const marker = `${ROLE_LINK_MARKER_PREFIX}${invitation.roleId}`;
  const salaryAmount = Math.max(0, Number(meta.salaryAmount ?? 0));
  const salaryNotes = typeof meta.salaryNotes === "string" ? meta.salaryNotes : "";

  const existingContract = await prisma.projectContract.findFirst({
    where: { projectId, type: "ACTOR", castingTalentId: invitation.talent.id },
    select: { id: true },
  });
  if (existingContract) return;

  const talent = invitation.talent;

  await prisma.$transaction(async (tx) => {
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

    const budget = await ensureDefaultProjectBudgetInTx(tx, projectId);

    const existingLine = await tx.projectBudgetLine.findFirst({
      where: { budgetId: budget.id, notes: { contains: marker } },
    });
    const notesWithMarker = `${salaryNotes}\n[${marker}]`.trim();

    if (existingLine) {
      await tx.projectBudgetLine.update({
        where: { id: existingLine.id },
        data: {
          department: "CAST",
          name: `Salary · ${invitation.role.name}`,
          quantity: 1,
          unitCost: salaryAmount,
          total: salaryAmount,
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
          unitCost: salaryAmount,
          total: salaryAmount,
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
          pastWork: talent.pastWork ?? null,
          contactEmail: talent.contactEmail ?? null,
        },
      });
    }

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
    const terms = `Role: ${invitation.role.name}\nSalary (planned): R${salaryAmount.toFixed(
      2,
    )}\nAgency: ${invitation.castingAgency?.agencyName ?? "N/A"}\n\nFinal terms to be signed by all parties.`;
    const version = await tx.projectContractVersion.create({
      data: { contractId: contract.id, version: 1, terms, createdById: userId },
    });
    await tx.projectContract.update({
      where: { id: contract.id },
      data: { currentVersionId: version.id },
    });
  });
}
