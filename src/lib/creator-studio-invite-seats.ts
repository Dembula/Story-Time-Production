import { prisma } from "@/lib/prisma";
import { seatCapFromGoals } from "@/lib/creator-studio-company-seats";

/** Members plus non-expired pending invites (each reserved seat). */
export async function countOccupiedStudioSeats(companyId: string): Promise<{
  members: number;
  pendingInvites: number;
  occupied: number;
}> {
  const now = new Date();
  const [members, pendingInvites] = await Promise.all([
    prisma.creatorStudioProfile.count({ where: { companyId } }),
    prisma.creatorStudioTeamInvite.count({
      where: { companyId, status: "PENDING", expiresAt: { gt: now } },
    }),
  ]);
  return { members, pendingInvites, occupied: members + pendingInvites };
}

/**
 * Company accounts registered with 1 seat (admin only) cannot invite until seatCap is raised.
 * Repair stale rows and align with the owner's chosen team size when possible.
 */
export async function repairCompanySeatCapForInvites(
  companyId: string,
  ownerUserId: string,
): Promise<{ seatCap: number; members: number; pendingInvites: number; occupied: number }> {
  const company = await prisma.studioCompany.findFirst({
    where: { id: companyId, ownerUserId },
    select: { id: true, seatCap: true },
  });
  if (!company) {
    throw new Error("Company not found");
  }

  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { creatorTeamSeatCap: true, goals: true, creatorAccountStructure: true },
  });

  const fromGoals = seatCapFromGoals(owner?.goals ?? null);
  const intended =
    owner?.creatorTeamSeatCap ??
    fromGoals ??
    (owner?.creatorAccountStructure === "COMPANY" ? 2 : company.seatCap);

  let seatCap = company.seatCap;
  const target = Math.min(5, Math.max(2, intended));
  if (seatCap < target) {
    await prisma.studioCompany.update({
      where: { id: companyId },
      data: { seatCap: target },
    });
    seatCap = target;
  }

  const seats = await countOccupiedStudioSeats(companyId);
  return { seatCap, ...seats };
}
