import "server-only";

import { prisma } from "@/lib/prisma";
import type { InputJsonValue } from "@/lib/prisma-json";
import type { ExecutiveOffice } from "@/lib/executive/seat-map";

export async function writeExecutiveAudit(args: {
  userId?: string | null;
  email?: string | null;
  office?: ExecutiveOffice | null;
  action: string;
  entityType?: string;
  entityId?: string;
  outcome?: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.executiveAuditLog.create({
      data: {
        userId: args.userId ?? null,
        email: args.email ?? null,
        office: args.office ?? null,
        action: args.action,
        entityType: args.entityType ?? null,
        entityId: args.entityId ?? null,
        outcome: args.outcome ?? "OK",
        meta: args.meta ? (args.meta as InputJsonValue) : undefined,
        ip: args.ip ?? null,
      },
    });
  } catch {
    // Soft-fail: never block the dashboard on audit write issues
  }
}
