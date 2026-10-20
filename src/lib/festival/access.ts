import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FESTIVAL_MEMBER_ROLE } from "@/lib/festival/constants";

export type FestivalMembershipRole =
  | typeof FESTIVAL_MEMBER_ROLE.OWNER
  | typeof FESTIVAL_MEMBER_ROLE.ADMIN
  | typeof FESTIVAL_MEMBER_ROLE.STAGE1_REVIEWER
  | typeof FESTIVAL_MEMBER_ROLE.STAGE2_REVIEWER;

export async function requireFestivalSession() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;
  if (!userId || (role !== "FESTIVAL_CURATOR" && role !== "ADMIN")) {
    return null;
  }
  return { session, userId, role };
}

export async function getFestivalMembership(festivalId: string, userId: string) {
  return prisma.festivalMembership.findUnique({
    where: { festivalId_userId: { festivalId, userId } },
  });
}

export function canManageFestival(memberRole: string | null | undefined, isAdmin = false): boolean {
  if (isAdmin) return true;
  return memberRole === FESTIVAL_MEMBER_ROLE.OWNER || memberRole === FESTIVAL_MEMBER_ROLE.ADMIN;
}

export function canStage1Review(memberRole: string | null | undefined, isAdmin = false): boolean {
  if (isAdmin) return true;
  return (
    memberRole === FESTIVAL_MEMBER_ROLE.OWNER ||
    memberRole === FESTIVAL_MEMBER_ROLE.ADMIN ||
    memberRole === FESTIVAL_MEMBER_ROLE.STAGE1_REVIEWER ||
    memberRole === FESTIVAL_MEMBER_ROLE.STAGE2_REVIEWER
  );
}

export function canStage2Review(memberRole: string | null | undefined, isAdmin = false): boolean {
  if (isAdmin) return true;
  return (
    memberRole === FESTIVAL_MEMBER_ROLE.OWNER ||
    memberRole === FESTIVAL_MEMBER_ROLE.ADMIN ||
    memberRole === FESTIVAL_MEMBER_ROLE.STAGE2_REVIEWER
  );
}

/** Load festival if the user is a member (or platform admin). */
export async function requireFestivalAccess(festivalId: string, userId: string, isPlatformAdmin = false) {
  const festival = await prisma.festival.findUnique({
    where: { id: festivalId },
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      mediaAssets: { orderBy: { sortOrder: "asc" } },
      flagDefs: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!festival) return null;
  if (isPlatformAdmin) {
    return { festival, membershipRole: FESTIVAL_MEMBER_ROLE.OWNER as FestivalMembershipRole };
  }
  const membership = await getFestivalMembership(festivalId, userId);
  if (!membership) return null;
  return { festival, membershipRole: membership.role as FestivalMembershipRole };
}

export async function listAccessibleFestivals(userId: string) {
  return prisma.festival.findMany({
    where: {
      OR: [
        { ownerUserId: userId },
        { memberships: { some: { userId } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      categories: { orderBy: { sortOrder: "asc" }, take: 6 },
      _count: { select: { submissions: true, memberships: true } },
    },
  });
}
