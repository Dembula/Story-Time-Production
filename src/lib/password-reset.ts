import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { buildAppUrl } from "@/lib/app-url";
import { sendPasswordResetEmail } from "@/lib/sendgrid";
import { logPasswordResetAudit } from "@/lib/password-reset-audit";

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function accountPortalFromRole(role?: string | null): "viewer" | "creator" | "admin" {
  if (!role || role === "SUBSCRIBER") return "viewer";
  if (role === "ADMIN") return "admin";
  return "creator";
}

export async function issuePasswordReset(email: string, meta?: { ip?: string | null }): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  await logPasswordResetAudit({
    status: "REQUEST_RECEIVED",
    email: normalizedEmail,
    ip: meta?.ip ?? null,
  });

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, role: true },
  });
  if (!user?.email) {
    await logPasswordResetAudit({
      status: "REQUEST_IGNORED_NO_USER",
      email: normalizedEmail,
      ip: meta?.ip ?? null,
    });
    return;
  }

  const rawToken = randomBytes(32).toString("hex");
  const token = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  const [, createdToken] = await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    }),
  ]);
  await logPasswordResetAudit({
    status: "TOKEN_CREATED",
    userId: user.id,
    email: user.email,
    tokenId: createdToken.id,
    ip: meta?.ip ?? null,
  });

  const portal = accountPortalFromRole(user.role);
  const resetLink = buildAppUrl(
    `/auth/reset-password?token=${encodeURIComponent(rawToken)}&portal=${encodeURIComponent(portal)}`
  );
  try {
    const mail = await sendPasswordResetEmail(user.email, resetLink);
    await logPasswordResetAudit({
      status: "EMAIL_SENT",
      userId: user.id,
      email: user.email,
      tokenId: createdToken.id,
      messageId: mail.messageId ?? null,
      ip: meta?.ip ?? null,
    });
  } catch (error) {
    await logPasswordResetAudit({
      status: "EMAIL_FAILED",
      userId: user.id,
      email: user.email,
      tokenId: createdToken.id,
      error: error instanceof Error ? error.message : "Unknown email error",
      ip: meta?.ip ?? null,
    });
    throw error;
  }
}

export async function consumePasswordResetToken(input: { token: string; newPasswordHash: string }): Promise<boolean> {
  const tokenHash = hashToken(input.token);
  const now = new Date();

  const reset = await prisma.passwordResetToken.findFirst({
    where: {
      token: tokenHash,
      used: false,
      expiresAt: { gt: now },
    },
    select: { id: true, userId: true },
  });

  if (!reset) {
    await logPasswordResetAudit({
      status: "CONFIRM_FAILED_INVALID_OR_EXPIRED",
      tokenId: tokenHash,
    });
    return false;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: input.newPasswordHash },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: reset.userId, used: false },
      data: { used: true },
    }),
  ]);

  await logPasswordResetAudit({
    status: "CONFIRM_SUCCESS",
    userId: reset.userId,
    tokenId: reset.id,
  });
  return true;
}
