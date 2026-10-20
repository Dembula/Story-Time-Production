import "server-only";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizeInviteEmail, inviteExpiresAtDefault } from "@/lib/creator-team-invites";
import { FESTIVAL_MEMBER_ROLE } from "@/lib/festival/constants";
import { notifyUser } from "@/lib/notify-user";

export function generateFestivalInviteToken(): string {
  return randomBytes(24).toString("hex");
}

/** Attach pending festival invites to a newly registered / known user by email. */
export async function linkPendingFestivalInvitesToUser(userId: string, email: string): Promise<void> {
  const emailNorm = normalizeInviteEmail(email);
  if (!emailNorm) return;
  try {
    await prisma.festivalTeamInvite.updateMany({
      where: {
        emailNorm,
        status: "PENDING",
        invitedUserId: null,
      },
      data: { invitedUserId: userId },
    });
  } catch {
    // Table may be missing on older environments; ignore.
  }
}

export async function createFestivalTeamInvite(args: {
  festivalId: string;
  invitedByUserId: string;
  email: string;
  role: string;
  personalMessage?: string | null;
}) {
  const emailNorm = normalizeInviteEmail(args.email);
  if (!emailNorm) return { ok: false as const, error: "Invalid email." };

  const allowedRoles = new Set([
    FESTIVAL_MEMBER_ROLE.ADMIN,
    FESTIVAL_MEMBER_ROLE.STAGE1_REVIEWER,
    FESTIVAL_MEMBER_ROLE.STAGE2_REVIEWER,
  ]);
  if (!allowedRoles.has(args.role as never)) {
    return { ok: false as const, error: "Invalid invite role." };
  }

  const existingMember = await prisma.user.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingMember) {
    const already = await prisma.festivalMembership.findUnique({
      where: { festivalId_userId: { festivalId: args.festivalId, userId: existingMember.id } },
    });
    if (already) return { ok: false as const, error: "User is already on this festival team." };
  }

  const pending = await prisma.festivalTeamInvite.findFirst({
    where: { festivalId: args.festivalId, emailNorm, status: "PENDING" },
  });
  if (pending) return { ok: false as const, error: "A pending invite already exists for this email." };

  const invite = await prisma.festivalTeamInvite.create({
    data: {
      festivalId: args.festivalId,
      invitedByUserId: args.invitedByUserId,
      emailNorm,
      invitedUserId: existingMember?.id ?? null,
      role: args.role,
      personalMessage: args.personalMessage?.trim() || null,
      token: generateFestivalInviteToken(),
      expiresAt: inviteExpiresAtDefault(),
      status: "PENDING",
    },
  });

  if (existingMember) {
    await notifyUser({
      userId: existingMember.id,
      type: "FESTIVAL_TEAM_INVITE",
      title: "Festival team invitation",
      body: "You have been invited to join a festival review team on Story Time.",
      metadata: {
        url: `/festival/join/${invite.token}`,
        inviteId: invite.id,
        festivalId: args.festivalId,
      },
    }).catch(() => {});
  }

  return { ok: true as const, invite };
}

export async function acceptFestivalTeamInvite(args: {
  token: string;
  userId: string;
  userEmail: string | null | undefined;
}) {
  const invite = await prisma.festivalTeamInvite.findUnique({
    where: { token: args.token },
    include: { festival: { select: { id: true, name: true } } },
  });
  if (!invite) return { ok: false as const, error: "Invite not found." };
  if (invite.status !== "PENDING") return { ok: false as const, error: "Invite is no longer pending." };
  if (invite.expiresAt.getTime() <= Date.now()) {
    await prisma.festivalTeamInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return { ok: false as const, error: "Invite has expired." };
  }

  const emailNorm = normalizeInviteEmail(args.userEmail ?? "");
  if (!emailNorm || emailNorm !== invite.emailNorm) {
    return { ok: false as const, error: "Sign in with the invited email address." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.festivalMembership.upsert({
      where: { festivalId_userId: { festivalId: invite.festivalId, userId: args.userId } },
      create: {
        festivalId: invite.festivalId,
        userId: args.userId,
        role: invite.role,
      },
      update: { role: invite.role },
    });
    await tx.festivalTeamInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", invitedUserId: args.userId },
    });
  });

  return { ok: true as const, festivalId: invite.festivalId, festivalName: invite.festival.name };
}
