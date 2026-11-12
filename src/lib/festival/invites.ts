import "server-only";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizeInviteEmail, inviteExpiresAtDefault } from "@/lib/creator-team-invites";
import { FESTIVAL_MEMBER_ROLE } from "@/lib/festival/constants";
import { notifyUser } from "@/lib/notify-user";
import { sendTransactionalEmail } from "@/lib/email";
import { buildAppUrl } from "@/lib/app-url";

export function generateFestivalInviteToken(): string {
  return randomBytes(24).toString("hex");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function roleLabel(role: string): string {
  switch (role) {
    case FESTIVAL_MEMBER_ROLE.ADMIN:
      return "Festival admin";
    case FESTIVAL_MEMBER_ROLE.STAGE1_REVIEWER:
      return "Stage 1 reviewer";
    case FESTIVAL_MEMBER_ROLE.STAGE2_REVIEWER:
      return "Stage 2 reviewer";
    default:
      return role.replace(/_/g, " ");
  }
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
  origin?: string | null;
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

  const festival = await prisma.festival.findUnique({
    where: { id: args.festivalId },
    select: { id: true, name: true },
  });
  if (!festival) return { ok: false as const, error: "Festival not found." };

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

  const inviter = await prisma.user.findUnique({
    where: { id: args.invitedByUserId },
    select: { name: true, email: true },
  });

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

  const joinPath = `/festival/join/${invite.token}`;
  const joinUrl = args.origin
    ? `${args.origin.replace(/\/$/, "")}${joinPath}`
    : buildAppUrl(joinPath);

  const inviterLabel = inviter?.name?.trim() || inviter?.email?.trim() || "A Story Time festival curator";
  const roleText = roleLabel(args.role);
  const personalMessage = args.personalMessage?.trim() || null;

  const emailBody = [
    `${inviterLabel} invited you to join the review team for "${festival.name}" on Story Time Festivals.`,
    `Role: ${roleText}`,
    personalMessage ? `\nMessage:\n${personalMessage}` : "",
    "",
    existingMember
      ? "You already have a Story Time account. Sign in with this email, then open the link below to accept the invite:"
      : "You don't have a Story Time account yet. Open the link below to create one with this email, then accept the invite:",
    joinUrl,
    "",
    "This invite expires in 14 days.",
  ]
    .filter(Boolean)
    .join("\n");

  let emailed = false;
  try {
    emailed = await sendTransactionalEmail({
      to: emailNorm,
      subject: existingMember
        ? `Accept your invite to review "${festival.name}"`
        : `You're invited to review "${festival.name}" — create your account`,
      text: emailBody,
      html: `
      <p><strong>${escapeHtml(inviterLabel)}</strong> invited you to join the review team for
      <strong>${escapeHtml(festival.name)}</strong> on Story Time Festivals.</p>
      <p>Role: ${escapeHtml(roleText)}</p>
      ${personalMessage ? `<p>${escapeHtml(personalMessage)}</p>` : ""}
      <p>${
        existingMember
          ? "You already have a Story Time account — sign in with this email and accept the invite."
          : "Create a Story Time account with this email, then accept the invite to join the festival team."
      }</p>
      <p><a href="${joinUrl}" style="display:inline-block;padding:10px 16px;background:#f97316;color:#0f172a;border-radius:8px;text-decoration:none;font-weight:600">
        ${existingMember ? "Accept festival team invite" : "Create account & join"}
      </a></p>
      <p style="color:#888;font-size:12px">This invite expires in 14 days.</p>
    `,
    });
    if (!emailed) {
      console.error("festival team invite email did not send", { emailNorm, festivalId: festival.id });
    }
  } catch (err) {
    console.error("festival team invite email failed", err);
  }

  // Existing Story Time users always get an in-app notification (plus the email above).
  if (existingMember) {
    await notifyUser({
      userId: existingMember.id,
      type: "FESTIVAL_TEAM_INVITE",
      title: `Accept invite: ${festival.name}`,
      body: `${inviterLabel} invited you to join "${festival.name}" as ${roleText}. Tap to review and accept.`,
      metadata: {
        url: joinPath,
        inviteId: invite.id,
        festivalId: args.festivalId,
        festivalName: festival.name,
        role: args.role,
      },
    }).catch(() => {});
  }

  return {
    ok: true as const,
    invite,
    joinUrl,
    emailed: Boolean(emailed),
    existingAccount: Boolean(existingMember),
  };
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
