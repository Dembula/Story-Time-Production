import "server-only";

import { prisma } from "@/lib/prisma";
import {
  generateInviteToken,
  inviteExpiresAtDefault,
  normalizeInviteEmail,
} from "@/lib/creator-team-invites";
import { findUserByInviteEmail } from "@/lib/creator-studio-company";
import { sendTransactionalEmail } from "@/lib/email";
import { notifyUser } from "@/lib/notify-user";
import { buildAppUrl } from "@/lib/app-url";
import { isPrismaMissingTable } from "@/lib/prisma-missing-table";

export type CreateProjectEmailInviteInput = {
  projectId: string;
  invitedByUserId: string;
  inviterName?: string | null;
  email: string;
  role?: string;
  department?: string | null;
  personalMessage?: string | null;
  origin?: string | null;
};

export async function assertCanInviteToProject(projectId: string, userId: string): Promise<{
  ok: true;
  project: { id: string; title: string };
} | { ok: false; status: number; error: string }> {
  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    select: { id: true, title: true },
  });
  if (!project) return { ok: false, status: 404, error: "Project not found" };

  const activeMember = await prisma.originalMember.findFirst({
    where: { projectId, userId, status: { in: ["ACTIVE", "ACCEPTED"] } },
  });
  const pitchOwner = await prisma.originalPitch.findFirst({
    where: { projectId, creatorId: userId },
    select: { id: true },
  });
  // Some projects surface creatorId from the primary pitch owner via the dashboard payload.
  if (!activeMember && !pitchOwner) {
    return { ok: false, status: 403, error: "You can only invite from projects you belong to" };
  }
  return { ok: true, project };
}

export async function createProjectCollaboratorEmailInvite(input: CreateProjectEmailInviteInput) {
  const emailNorm = normalizeInviteEmail(input.email);
  if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return { ok: false as const, status: 400, error: "A valid email is required" };
  }

  const gate = await assertCanInviteToProject(input.projectId, input.invitedByUserId);
  if (!gate.ok) return gate;

  const inviter = await prisma.user.findUnique({
    where: { id: input.invitedByUserId },
    select: { email: true, name: true },
  });
  if (inviter?.email && normalizeInviteEmail(inviter.email) === emailNorm) {
    return { ok: false as const, status: 400, error: "You cannot invite your own email address." };
  }

  const existingUser = await findUserByInviteEmail(emailNorm);
  if (existingUser?.id === input.invitedByUserId) {
    return { ok: false as const, status: 400, error: "You cannot invite yourself." };
  }

  if (existingUser) {
    const alreadyMember = await prisma.originalMember.findFirst({
      where: {
        projectId: input.projectId,
        userId: existingUser.id,
        status: { in: ["ACTIVE", "ACCEPTED", "INVITED"] },
      },
    });
    if (alreadyMember) {
      return {
        ok: false as const,
        status: 409,
        error:
          alreadyMember.status === "INVITED"
            ? "That creator already has a pending invite on this project."
            : "That creator is already on this project.",
      };
    }
  }

  try {
    const dup = await prisma.projectCollaboratorInvite.findFirst({
      where: {
        projectId: input.projectId,
        emailNorm,
        status: "PENDING",
      },
    });
    if (dup) {
      return { ok: false as const, status: 409, error: "An open email invite already exists for this address on this project." };
    }
  } catch (e) {
    if (isPrismaMissingTable(e, "ProjectCollaboratorInvite")) {
      return {
        ok: false as const,
        status: 503,
        error: "Project email invites are not available yet. Apply the latest database migrations and restart.",
      };
    }
    throw e;
  }

  const role = (input.role ?? "Collaborator").trim() || "Collaborator";
  const department = input.department?.trim() || null;
  const personalMessage =
    typeof input.personalMessage === "string" ? input.personalMessage.trim().slice(0, 2000) || null : null;
  const token = generateInviteToken();

  const invite = await prisma.projectCollaboratorInvite.create({
    data: {
      projectId: input.projectId,
      invitedByUserId: input.invitedByUserId,
      emailNorm,
      invitedUserId: existingUser?.id ?? null,
      role,
      department,
      personalMessage,
      status: "PENDING",
      token,
      expiresAt: inviteExpiresAtDefault(),
    },
  });

  const joinPath = `/creator/join/project/${token}`;
  const joinUrl = input.origin
    ? `${input.origin.replace(/\/$/, "")}${joinPath}`
    : buildAppUrl(joinPath);

  const inviterLabel = input.inviterName?.trim() || inviter?.name?.trim() || "A Story Time creator";
  const emailBody = [
    `${inviterLabel} invited you to collaborate on "${gate.project.title}" on Story Time.`,
    role ? `Role: ${role}` : "",
    personalMessage ? `\nMessage:\n${personalMessage}` : "",
    "",
    existingUser
      ? "Sign in with this email and open the link to accept:"
      : "Create a creator account with this email (or sign in), then open the link to join the project:",
    joinUrl,
    "",
    "This invite expires in 14 days.",
  ]
    .filter(Boolean)
    .join("\n");

  const emailed = await sendTransactionalEmail({
    to: emailNorm,
    subject: `You're invited to collaborate on "${gate.project.title}"`,
    text: emailBody,
    html: `
      <p><strong>${escapeHtml(inviterLabel)}</strong> invited you to collaborate on <strong>${escapeHtml(gate.project.title)}</strong> on Story Time.</p>
      ${role ? `<p>Role: ${escapeHtml(role)}</p>` : ""}
      ${personalMessage ? `<p>${escapeHtml(personalMessage)}</p>` : ""}
      <p><a href="${joinUrl}">${existingUser ? "Accept project invite" : "Create your creator account & join"}</a></p>
      <p style="color:#888;font-size:12px">This invite expires in 14 days.</p>
    `,
  });

  if (existingUser) {
    await notifyUser({
      userId: existingUser.id,
      type: "PROJECT_COLLAB_INVITE",
      title: "Project collaboration invite",
      body: `${inviterLabel} invited you to join "${gate.project.title}" as ${role}. Open the invite link in your email or My Projects.`,
      metadata: {
        projectId: input.projectId,
        inviteId: invite.id,
        url: joinPath,
      },
    });
    // Also surface in the network-style My Projects inbox.
    await prisma.originalMember.upsert({
      where: { userId_projectId: { userId: existingUser.id, projectId: input.projectId } },
      create: {
        userId: existingUser.id,
        projectId: input.projectId,
        role,
        department,
        status: "INVITED",
      },
      update: {
        role,
        department,
        status: "INVITED",
      },
    });
  }

  return {
    ok: true as const,
    invite: {
      id: invite.id,
      emailNorm: invite.emailNorm,
      status: invite.status,
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
    },
    registeredOnPlatform: Boolean(existingUser),
    joinUrl,
    emailed,
    message: existingUser
      ? emailed
        ? "Invite emailed. They can accept from the link or My Projects."
        : "Invite created and notified in-app. Email delivery failed — share the join link."
      : emailed
        ? "Invite emailed. After they create a creator account with that email, they'll get access to this project."
        : "Invite saved, but email could not be sent. Share the join link with them.",
  };
}

/**
 * After creator registration: attach pending email invites and grant project access.
 */
export async function linkPendingProjectInvitesToUser(userId: string, email: string): Promise<void> {
  const emailNorm = normalizeInviteEmail(email);
  if (!emailNorm) return;

  try {
    const pending = await prisma.projectCollaboratorInvite.findMany({
      where: {
        emailNorm,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    for (const invite of pending) {
      await prisma.$transaction(async (tx) => {
        await tx.projectCollaboratorInvite.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED", invitedUserId: userId },
        });
        await tx.originalMember.upsert({
          where: { userId_projectId: { userId, projectId: invite.projectId } },
          create: {
            userId,
            projectId: invite.projectId,
            role: invite.role || "Collaborator",
            department: invite.department,
            status: "ACTIVE",
          },
          update: {
            role: invite.role || "Collaborator",
            department: invite.department,
            status: "ACTIVE",
          },
        });
      });
    }
  } catch (e) {
    if (isPrismaMissingTable(e, "ProjectCollaboratorInvite")) return;
    throw e;
  }
}

export async function acceptProjectCollaboratorInvite(options: {
  token: string;
  userId: string;
  userEmail: string | null | undefined;
  action: "accept" | "decline";
}) {
  const emailNorm = normalizeInviteEmail(options.userEmail ?? "");
  const invite = await prisma.projectCollaboratorInvite.findUnique({
    where: { token: options.token },
    include: { project: { select: { id: true, title: true } } },
  });
  if (!invite) return { ok: false as const, status: 404, error: "Invite not found" };
  if (invite.status === "ACCEPTED") {
    // Idempotent: ensure membership exists if they already activated via signup auto-grant.
    await prisma.originalMember.upsert({
      where: { userId_projectId: { userId: options.userId, projectId: invite.projectId } },
      create: {
        userId: options.userId,
        projectId: invite.projectId,
        role: invite.role || "Collaborator",
        department: invite.department,
        status: "ACTIVE",
      },
      update: { status: "ACTIVE" },
    });
    return {
      ok: true as const,
      declined: false as const,
      projectId: invite.projectId,
      projectTitle: invite.project.title,
      alreadyAccepted: true as const,
    };
  }
  if (invite.status !== "PENDING") {
    return { ok: false as const, status: 410, error: "This invite is no longer pending." };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.projectCollaboratorInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return { ok: false as const, status: 410, error: "This invite has expired." };
  }
  if (!emailNorm || invite.emailNorm !== emailNorm) {
    return {
      ok: false as const,
      status: 403,
      error: "This invite was sent to a different email than the one you are signed in with.",
    };
  }

  if (options.action === "decline") {
    await prisma.projectCollaboratorInvite.update({
      where: { id: invite.id },
      data: { status: "DECLINED", invitedUserId: options.userId },
    });
    return { ok: true as const, declined: true as const, projectId: invite.projectId };
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectCollaboratorInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", invitedUserId: options.userId },
    });
    await tx.originalMember.upsert({
      where: { userId_projectId: { userId: options.userId, projectId: invite.projectId } },
      create: {
        userId: options.userId,
        projectId: invite.projectId,
        role: invite.role || "Collaborator",
        department: invite.department,
        status: "ACTIVE",
      },
      update: {
        role: invite.role || "Collaborator",
        department: invite.department,
        status: "ACTIVE",
      },
    });
  });

  return {
    ok: true as const,
    declined: false as const,
    projectId: invite.projectId,
    projectTitle: invite.project.title,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
