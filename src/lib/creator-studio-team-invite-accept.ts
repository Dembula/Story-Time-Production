import { prisma } from "@/lib/prisma";
import { normalizeInviteEmail } from "@/lib/creator-team-invites";
import { isPrismaMissingTable, isMissingUserStudioWorkspacePrismaField } from "@/lib/prisma-missing-table";

export type AcceptStudioInviteResult =
  | { ok: true; status: "ACCEPTED" | "ALREADY_MEMBER" | "DECLINED"; profileId?: string; companyId?: string }
  | { ok: false; status: number; error: string };

export async function acceptStudioTeamInviteForUser(opts: {
  userId: string;
  email: string;
  displayName: string | null | undefined;
  inviteId?: string;
  token?: string;
  action: "accept" | "decline";
}): Promise<AcceptStudioInviteResult> {
  const emailNorm = normalizeInviteEmail(opts.email);
  if (!emailNorm) {
    return { ok: false, status: 400, error: "A valid signed-in email is required." };
  }

  const token = opts.token?.trim() ?? "";
  const inviteId = opts.inviteId?.trim() ?? "";
  if (!token && !inviteId) {
    return { ok: false, status: 400, error: "Invite id or token is required." };
  }

  let invite;
  try {
    invite = token
      ? await prisma.creatorStudioTeamInvite.findUnique({
          where: { token },
          include: { company: true },
        })
      : await prisma.creatorStudioTeamInvite.findUnique({
          where: { id: inviteId },
          include: { company: true },
        });
  } catch (e) {
    if (isPrismaMissingTable(e, "CreatorStudioTeamInvite")) {
      return {
        ok: false,
        status: 503,
        error: "Team invites are not available yet. Ask support to apply database migrations.",
      };
    }
    throw e;
  }

  if (!invite) {
    return { ok: false, status: 404, error: "Invite not found." };
  }
  if (normalizeInviteEmail(invite.emailNorm) !== emailNorm) {
    return {
      ok: false,
      status: 403,
      error: "This invite was sent to a different email than the one you are signed in with.",
    };
  }
  if (invite.status !== "PENDING") {
    return { ok: false, status: 400, error: "This invite is no longer active." };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.creatorStudioTeamInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return { ok: false, status: 400, error: "This invite has expired." };
  }

  if (opts.action === "decline") {
    await prisma.creatorStudioTeamInvite.update({
      where: { id: invite.id },
      data: { status: "DECLINED" },
    });
    return { ok: true, status: "DECLINED" };
  }

  const memberCount = await prisma.creatorStudioProfile.count({
    where: { companyId: invite.companyId },
  });
  if (memberCount >= invite.company.seatCap) {
    return {
      ok: false,
      status: 400,
      error: "This studio has reached its seat limit. Ask the owner to increase seats.",
    };
  }

  const already = await prisma.creatorStudioProfile.findFirst({
    where: { companyId: invite.companyId, userId: opts.userId },
  });
  if (already) {
    await prisma.creatorStudioTeamInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", invitedUserId: opts.userId },
    });
    return { ok: true, status: "ALREADY_MEMBER", profileId: already.id, companyId: invite.companyId };
  }

  const display = (opts.displayName?.trim() || emailNorm.split("@")[0] || "Team member").slice(0, 120);
  const suiteMask =
    invite.suiteAccess != null ? { suites: invite.suiteAccess as unknown } : undefined;

  const profile = await prisma.$transaction(async (tx) => {
    const p = await tx.creatorStudioProfile.create({
      data: {
        userId: opts.userId,
        companyId: invite.companyId,
        displayName: display,
        kind: "COMPANY",
        teamRole: "Member",
        ...(suiteMask != null ? { pipelineSectionMask: suiteMask as object } : {}),
      },
    });
    await tx.creatorStudioTeamInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", invitedUserId: opts.userId },
    });
    try {
      await tx.user.update({
        where: { id: opts.userId },
        data: { activeCreatorStudioProfileId: p.id },
      });
    } catch (e) {
      if (!isMissingUserStudioWorkspacePrismaField(e)) throw e;
    }
    return p;
  });

  return {
    ok: true,
    status: "ACCEPTED",
    profileId: profile.id,
    companyId: invite.companyId,
  };
}
