import { NextRequest, NextResponse } from "next/server";
import { actorHasAdminRight, requireAdminApiActor } from "@/lib/admin-api-auth";
import { markPaymentFundsCleared } from "@/lib/payments/funds-clearing";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireFinanceActor() {
  const actor = await requireAdminApiActor();
  if ("error" in actor) return actor;
  if (!actorHasAdminRight(actor, "canManageFinance") && !actor.isGod) {
    return { error: "Forbidden", status: 403 as const };
  }
  return actor;
}

/** Manually mark a PayFast/Apple payment cleared early (before the 3d / 45d clock). */
export async function POST(req: NextRequest) {
  const actor = await requireFinanceActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const body = (await req.json().catch(() => null)) as { paymentRecordId?: string } | null;
  const paymentRecordId = body?.paymentRecordId?.trim();
  if (!paymentRecordId) {
    return NextResponse.json({ error: "paymentRecordId is required." }, { status: 400 });
  }

  const result = await markPaymentFundsCleared({
    paymentRecordId,
    mode: "manual",
    clearedByUserId: actor.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: actor.id,
        action: "PAYMENT_FUNDS_CLEARED_MANUAL",
        entityType: "PaymentRecord",
        entityId: paymentRecordId,
        newValue: { mode: "manual", allocated: result.allocated, already: result.already ?? false },
      },
    });
  } catch {
    /* best-effort */
  }

  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentRecordId },
    select: {
      id: true,
      provider: true,
      fundsClearDueAt: true,
      fundsClearedAt: true,
      fundsClearedMode: true,
      ledgerAllocatedAt: true,
    },
  });

  return NextResponse.json({ ...result, payment });
}
