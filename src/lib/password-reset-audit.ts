import { prisma } from "@/lib/prisma";

type ResetAuditStatus =
  | "REQUEST_RECEIVED"
  | "REQUEST_IGNORED_NO_USER"
  | "TOKEN_CREATED"
  | "EMAIL_SENT"
  | "EMAIL_FAILED"
  | "CONFIRM_SUCCESS"
  | "CONFIRM_FAILED_INVALID_OR_EXPIRED";

type LogResetAuditInput = {
  status: ResetAuditStatus;
  userId?: string | null;
  email?: string | null;
  tokenId?: string | null;
  messageId?: string | null;
  error?: string | null;
  ip?: string | null;
};

export async function logPasswordResetAudit(input: LogResetAuditInput): Promise<void> {
  try {
    await prisma.opsIncident.create({
      data: {
        kind: "password_reset_audit",
        severity: input.status === "EMAIL_FAILED" ? "critical" : "warning",
        message: `password reset: ${input.status}`,
        detail: {
          status: input.status,
          userId: input.userId ?? null,
          email: input.email ?? null,
          tokenId: input.tokenId ?? null,
          messageId: input.messageId ?? null,
          error: input.error ?? null,
          ip: input.ip ?? null,
        },
      },
    });
  } catch (error) {
    console.error("Password reset audit log write failed:", error);
  }
}
