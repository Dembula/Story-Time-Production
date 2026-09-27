import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { buildPublicAppUrl } from "@/lib/app-url";
import { sendPasswordResetEmail } from "@/lib/sendgrid";
import { logPasswordResetAudit } from "@/lib/password-reset-audit";
import { isPasswordResetTokenFormat, normalizePasswordResetToken } from "@/lib/password-reset-token";
import { isEmailTransportConfigured } from "@/lib/email";

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildPasswordResetLink(rawToken: string, portal: "viewer" | "creator" | "admin"): string {
  const encodedToken = encodeURIComponent(rawToken);
  const encodedPortal = encodeURIComponent(portal);
  // Query token matches SendGrid templates (?token={{token}}); path segment kept for older links.
  return buildPublicAppUrl(
    `/auth/reset-password?token=${encodedToken}&portal=${encodedPortal}`,
  );
}

function accountPortalFromRole(role?: string | null): "viewer" | "creator" | "admin" {
  if (!role || role === "SUBSCRIBER") return "viewer";
  if (role === "ADMIN") return "admin";
  return "creator";
}

async function findUserForPasswordReset(normalizedEmail: string) {
  const exact = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, role: true },
  });
  if (exact?.email) return exact;

  // Catch legacy rows stored with mixed case.
  return prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true, email: true, role: true },
  });
}

export async function issuePasswordReset(email: string, meta?: { ip?: string | null }): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  await logPasswordResetAudit({
    status: "REQUEST_RECEIVED",
    email: normalizedEmail,
    ip: meta?.ip ?? null,
  });

  const user = await findUserForPasswordReset(normalizedEmail);
  if (!user?.email) {
    await logPasswordResetAudit({
      status: "REQUEST_IGNORED_NO_USER",
      email: normalizedEmail,
      ip: meta?.ip ?? null,
    });
    return;
  }

  if (!isEmailTransportConfigured()) {
    const err = new Error(
      "No email transport configured (set SENDGRID_API_KEY, RESEND_API_KEY, or EMAIL_SERVER).",
    );
    await logPasswordResetAudit({
      status: "EMAIL_FAILED",
      userId: user.id,
      email: user.email,
      error: err.message,
      ip: meta?.ip ?? null,
    });
    throw err;
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  const [, createdToken] = await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
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

  // Prefer lowercase canonical email on the account when we matched via insensitive lookup.
  if (user.email !== normalizedEmail) {
    await prisma.user
      .update({ where: { id: user.id }, data: { email: normalizedEmail } })
      .catch((e) => console.warn("[password-reset] email normalize failed:", e));
  }

  const portal = accountPortalFromRole(user.role);
  const resetLink = buildPasswordResetLink(rawToken, portal);
  const deliveryEmail = normalizedEmail || user.email;
  try {
    const mail = await sendPasswordResetEmail(deliveryEmail, resetLink, { rawToken, portal });
    await logPasswordResetAudit({
      status: "EMAIL_SENT",
      userId: user.id,
      email: deliveryEmail,
      tokenId: createdToken.id,
      messageId: mail.messageId ?? null,
      ip: meta?.ip ?? null,
    });
  } catch (error) {
    await logPasswordResetAudit({
      status: "EMAIL_FAILED",
      userId: user.id,
      email: deliveryEmail,
      tokenId: createdToken.id,
      error: error instanceof Error ? error.message : "Unknown email error",
      ip: meta?.ip ?? null,
    });
    throw error;
  }
}

export async function findValidPasswordResetToken(rawToken: string) {
  const normalized = normalizePasswordResetToken(rawToken);
  if (!isPasswordResetTokenFormat(normalized)) return null;

  const tokenHash = hashToken(normalized);
  const now = new Date();

  return prisma.passwordResetToken.findFirst({
    where: {
      token: tokenHash,
      used: false,
      expiresAt: { gt: now },
    },
    select: { id: true, userId: true, expiresAt: true },
  });
}

export async function consumePasswordResetToken(input: { token: string; newPasswordHash: string }): Promise<boolean> {
  const normalized = normalizePasswordResetToken(input.token);
  if (!isPasswordResetTokenFormat(normalized)) {
    await logPasswordResetAudit({
      status: "CONFIRM_FAILED_INVALID_OR_EXPIRED",
      error: "invalid_token_format",
    });
    return false;
  }

  const tokenHash = hashToken(normalized);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const reset = await tx.passwordResetToken.findFirst({
      where: {
        token: tokenHash,
        used: false,
        expiresAt: { gt: now },
      },
      select: { id: true, userId: true },
    });
    if (!reset) return null;

    // Atomic claim — prevents double-spend if two confirms race.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, used: false, expiresAt: { gt: now } },
      data: { used: true },
    });
    if (claimed.count !== 1) return null;

    await tx.user.update({
      where: { id: reset.userId },
      data: { passwordHash: input.newPasswordHash },
    });

    await tx.passwordResetToken.updateMany({
      where: { userId: reset.userId, used: false },
      data: { used: true },
    });

    // Force re-login after password change.
    await tx.session.deleteMany({ where: { userId: reset.userId } });

    return reset;
  });

  if (!result) {
    await logPasswordResetAudit({
      status: "CONFIRM_FAILED_INVALID_OR_EXPIRED",
      tokenId: tokenHash,
    });
    return false;
  }

  await logPasswordResetAudit({
    status: "CONFIRM_SUCCESS",
    userId: result.userId,
    tokenId: result.id,
  });
  return true;
}
