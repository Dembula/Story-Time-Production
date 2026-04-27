import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { buildAppUrl } from "@/lib/app-url";
import { sendPasswordResetEmail } from "@/lib/sendgrid";

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function accountPortalFromRole(role?: string | null): "viewer" | "creator" | "admin" {
  if (!role || role === "SUBSCRIBER") return "viewer";
  if (role === "ADMIN") return "admin";
  return "creator";
}

export async function issuePasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, role: true },
  });
  if (!user?.email) return;

  const rawToken = randomBytes(32).toString("hex");
  const token = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.$transaction([
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

  const portal = accountPortalFromRole(user.role);
  const resetLink = buildAppUrl(
    `/auth/reset-password?token=${encodeURIComponent(rawToken)}&portal=${encodeURIComponent(portal)}`
  );
  await sendPasswordResetEmail(user.email, resetLink);
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

  if (!reset) return false;

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

  return true;
}
