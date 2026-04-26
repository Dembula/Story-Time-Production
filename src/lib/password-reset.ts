import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { buildAppUrl } from "@/lib/app-url";
import { sendTransactionalEmail } from "@/lib/email";

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildResetEmail(link: string): { text: string; html: string } {
  const text = [
    "Story Time password reset",
    "",
    "We received a request to reset your password.",
    "Use this secure link to create a new password:",
    link,
    "",
    "This link expires in 60 minutes and can only be used once.",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = `
    <p><strong>Story Time password reset</strong></p>
    <p>We received a request to reset your password.</p>
    <p><a href="${link}">Reset your password</a></p>
    <p>This link expires in 60 minutes and can only be used once.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  return { text, html };
}

export async function issuePasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true },
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

  const resetLink = buildAppUrl(`/auth/reset-password?token=${encodeURIComponent(rawToken)}`);
  const emailBody = buildResetEmail(resetLink);
  await sendTransactionalEmail({
    to: user.email,
    subject: "Story Time password reset",
    text: emailBody.text,
    html: emailBody.html,
  });
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
