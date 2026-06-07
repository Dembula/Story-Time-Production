import { prisma } from "@/lib/prisma";
import { parseEmbeddedMeta } from "@/lib/marketplace-profile-meta";
import { normalizeInviteEmail } from "@/lib/creator-team-invites";
import { seatCapFromGoals } from "@/lib/creator-studio-company-seats";
import {
  isMissingCreatorStudioInfrastructure,
  isMissingUserStudioWorkspacePrismaField,
  isPrismaMissingTable,
} from "@/lib/prisma-missing-table";

export type CreatorStudioAccountIntent = {
  structure: "INDIVIDUAL" | "COMPANY";
  seatCap: number;
  displayName: string;
};

function studioDelegatesReady(): boolean {
  const ext = prisma as unknown as {
    creatorStudioProfile?: { count: unknown };
    studioCompany?: { findFirst: unknown };
  };
  return (
    typeof ext.creatorStudioProfile?.count === "function" &&
    typeof ext.studioCompany?.findFirst === "function"
  );
}

/** Resolve whether this film/music creator registered as individual or company (DB column or goals meta). */
export async function resolveCreatorStudioAccountIntent(
  userId: string,
): Promise<CreatorStudioAccountIntent | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      name: true,
      email: true,
      goals: true,
      creatorAccountStructure: true,
      creatorTeamSeatCap: true,
    },
  });
  if (!user || (user.role !== "CONTENT_CREATOR" && user.role !== "MUSIC_CREATOR")) {
    return null;
  }

  let structure: "INDIVIDUAL" | "COMPANY" = "INDIVIDUAL";
  if (user.creatorAccountStructure === "COMPANY") {
    structure = "COMPANY";
  } else if (user.creatorAccountStructure !== "INDIVIDUAL") {
    const { meta } = parseEmbeddedMeta<{ accountStructure?: string }>(user.goals);
    if (meta?.accountStructure === "COMPANY") structure = "COMPANY";
  }

  const seatCap =
    structure === "COMPANY"
      ? Math.min(
          5,
          Math.max(
            1,
            user.creatorTeamSeatCap ?? seatCapFromGoals(user.goals) ?? 2,
          ),
        )
      : 1;

  const displayName = (user.name?.trim() || user.email?.split("@")[0] || "Creator").slice(0, 120);
  return { structure, seatCap, displayName };
}

/**
 * Company creators must own a StudioCompany row to invite teammates.
 * Repairs accounts that registered as company before studio tables existed.
 */
export async function ensureOwnedStudioCompanyForUser(userId: string): Promise<void> {
  if (!studioDelegatesReady()) return;

  const intent = await resolveCreatorStudioAccountIntent(userId);
  if (!intent || intent.structure !== "COMPANY") return;

  let owned: { id: string } | null;
  try {
    owned = await prisma.studioCompany.findFirst({
      where: { ownerUserId: userId },
      select: { id: true },
    });
  } catch (e) {
    if (isMissingCreatorStudioInfrastructure(e) || isPrismaMissingTable(e, "StudioCompany")) {
      return;
    }
    throw e;
  }
  if (owned) return;

  try {
    await prisma.$transaction(async (tx) => {
      const company = await tx.studioCompany.create({
        data: {
          ownerUserId: userId,
          displayName: intent.displayName,
          seatCap: intent.seatCap,
        },
      });

      const existingProfile = await tx.creatorStudioProfile.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });

      if (existingProfile) {
        await tx.creatorStudioProfile.update({
          where: { id: existingProfile.id },
          data: {
            companyId: company.id,
            kind: "COMPANY",
            teamRole: existingProfile.teamRole ?? "Admin",
          },
        });
        try {
          await tx.user.update({
            where: { id: userId },
            data: { activeCreatorStudioProfileId: existingProfile.id },
          });
        } catch (e) {
          if (!isMissingUserStudioWorkspacePrismaField(e)) throw e;
        }
      } else {
        const prof = await tx.creatorStudioProfile.create({
          data: {
            userId,
            companyId: company.id,
            displayName: intent.displayName,
            kind: "COMPANY",
            teamRole: "Admin",
          },
        });
        try {
          await tx.user.update({
            where: { id: userId },
            data: { activeCreatorStudioProfileId: prof.id },
          });
        } catch (e) {
          if (!isMissingUserStudioWorkspacePrismaField(e)) throw e;
        }
      }
    });
  } catch (e) {
    if (
      isMissingCreatorStudioInfrastructure(e) ||
      isPrismaMissingTable(e, "StudioCompany") ||
      isPrismaMissingTable(e, "CreatorStudioProfile")
    ) {
      return;
    }
    throw e;
  }
}

/** Case-insensitive email lookup for invites (emails may not be normalized in legacy rows). */
export async function findUserByInviteEmail(emailNorm: string) {
  const direct = await prisma.user.findUnique({
    where: { email: emailNorm },
    select: { id: true, email: true, name: true, role: true },
  });
  if (direct) return direct;

  return prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
    select: { id: true, email: true, name: true, role: true },
  });
}

/** Attach pending studio invites to a user after they register or sign in with the invited email. */
export async function linkPendingStudioInvitesToUser(userId: string, email: string): Promise<void> {
  const emailNorm = normalizeInviteEmail(email);
  if (!emailNorm) return;

  const inviteDelegate = (prisma as unknown as { creatorStudioTeamInvite?: { updateMany: unknown } })
    .creatorStudioTeamInvite;
  if (typeof inviteDelegate?.updateMany !== "function") return;

  try {
    await prisma.creatorStudioTeamInvite.updateMany({
      where: {
        emailNorm,
        status: "PENDING",
        invitedUserId: null,
      },
      data: { invitedUserId: userId },
    });
  } catch (e) {
    if (isPrismaMissingTable(e, "CreatorStudioTeamInvite")) return;
    throw e;
  }
}
