import { prisma } from "@/lib/prisma";

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
