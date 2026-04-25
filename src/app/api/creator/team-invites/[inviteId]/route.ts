import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeInviteEmail } from "@/lib/creator-team-invites";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ inviteId: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const email = session?.user?.email?.trim().toLowerCase();
  if (!userId || !email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { inviteId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const action = body?.action === "decline" ? "decline" : body?.action === "accept" ? "accept" : null;
  if (!action) return NextResponse.json({ error: "action must be accept or decline" }, { status: 400 });

  const invite = await prisma.creatorStudioTeamInvite.findFirst({
    where: { id: inviteId, emailNorm: normalizeInviteEmail(email) },
    include: { company: true },
  });
  if (!invite) {
    return NextResponse.json({ error: "Invite not found for your account." }, { status: 404 });
  }
  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "This invite is no longer active." }, { status: 400 });
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.creatorStudioTeamInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ error: "This invite has expired." }, { status: 400 });
  }

  if (action === "decline") {
    await prisma.creatorStudioTeamInvite.update({
      where: { id: invite.id },
      data: { status: "DECLINED" },
    });
    return NextResponse.json({ ok: true, status: "DECLINED" });
  }

  const memberCount = await prisma.creatorStudioProfile.count({
    where: { companyId: invite.companyId },
  });
  if (memberCount >= invite.company.seatCap) {
    return NextResponse.json(
      { error: "This studio has reached its seat limit. Ask the owner to increase seats." },
      { status: 400 },
    );
  }

  const already = await prisma.creatorStudioProfile.findFirst({
    where: { companyId: invite.companyId, userId },
  });
  if (already) {
    await prisma.creatorStudioTeamInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    });
    return NextResponse.json({ ok: true, status: "ALREADY_MEMBER", profileId: already.id });
  }

  const display =
    (session!.user?.name?.trim() || email.split("@")[0] || "Team member").slice(0, 120);
  const suiteMask =
    invite.suiteAccess != null
      ? { suites: invite.suiteAccess as unknown }
      : undefined;

  const profile = await prisma.$transaction(async (tx) => {
    const p = await tx.creatorStudioProfile.create({
      data: {
        userId,
        companyId: invite.companyId,
        displayName: display,
        kind: "COMPANY",
        teamRole: "Member",
        ...(suiteMask != null ? { pipelineSectionMask: suiteMask as object } : {}),
      },
    });
    await tx.creatorStudioTeamInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", invitedUserId: userId },
    });
    return p;
  });

  return NextResponse.json({
    ok: true,
    status: "ACCEPTED",
    profileId: profile.id,
    companyId: invite.companyId,
  });
}
