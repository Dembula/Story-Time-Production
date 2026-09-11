import { NextRequest, NextResponse } from "next/server";
import { actorHasAdminRight, requireAdminApiActor } from "@/lib/admin-api-auth";
import {
  getRevenueConnector,
  listRevenueConnectorHistory,
  upsertRevenueConnector,
} from "@/lib/finance/revenue-connector";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireSystemActor() {
  const actor = await requireAdminApiActor();
  if ("error" in actor) return actor;
  if (!actorHasAdminRight(actor, "canManageSystem") && !actor.isGod) {
    return { error: "Forbidden", status: 403 as const };
  }
  return actor;
}

export async function GET() {
  const actor = await requireSystemActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const [settings, history] = await Promise.all([
    getRevenueConnector(),
    listRevenueConnectorHistory(20),
  ]);

  return NextResponse.json({
    settings,
    history: history.map((row) => ({
      id: row.id,
      creatorRevenueTrackingEnabled: row.creatorRevenueTrackingEnabled,
      note: row.note,
      updatedByUserId: row.updatedByUserId,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireSystemActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const body = (await req.json().catch(() => ({}))) as {
    creatorRevenueTrackingEnabled?: boolean;
    note?: string | null;
  };

  if (typeof body.creatorRevenueTrackingEnabled !== "boolean") {
    return NextResponse.json(
      { error: "creatorRevenueTrackingEnabled (boolean) is required" },
      { status: 400 },
    );
  }

  const settings = await upsertRevenueConnector({
    creatorRevenueTrackingEnabled: body.creatorRevenueTrackingEnabled,
    note: body.note,
    updatedByUserId: actor.id,
  });

  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: actor.id,
        action: body.creatorRevenueTrackingEnabled
          ? "REVENUE_CONNECTOR_ENABLED"
          : "REVENUE_CONNECTOR_PAUSED",
        entityType: "PlatformRevenueConnector",
        entityId: settings.id ?? "unknown",
        newValue: {
          creatorRevenueTrackingEnabled: settings.creatorRevenueTrackingEnabled,
          note: settings.note,
        },
      },
    });
  } catch {
    // Audit is best-effort; do not fail the switch.
  }

  return NextResponse.json({ settings });
}
