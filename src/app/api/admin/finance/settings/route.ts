import { NextRequest, NextResponse } from "next/server";
import {
  actorHasAdminRight,
  requireAdminApiActor,
} from "@/lib/admin-api-auth";
import {
  getFinanceFeeSettings,
  listFinanceFeeSettingsHistory,
  upsertFinanceFeeSettings,
  validateFinanceFeeSettingsInput,
} from "@/lib/finance/fee-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireFinanceActor() {
  const actor = await requireAdminApiActor();
  if ("error" in actor) return actor;
  if (!actorHasAdminRight(actor, "canManageFinance") && !actorHasAdminRight(actor, "canManageRevenue") && !actor.isGod) {
    return { error: "Forbidden", status: 403 as const };
  }
  return actor;
}

export async function GET() {
  const actor = await requireFinanceActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const [settings, history] = await Promise.all([
    getFinanceFeeSettings(),
    listFinanceFeeSettingsHistory(30),
  ]);

  return NextResponse.json({
    settings,
    history: history.map((h) => ({
      id: h.id,
      appleCommissionRate: h.appleCommissionRate,
      viewerCreatorSplit: h.viewerCreatorSplit,
      viewerPlatformSplit: h.viewerPlatformSplit,
      marketplaceFeeRate: h.marketplaceFeeRate,
      note: h.note,
      updatedByUserId: h.updatedByUserId,
      createdAt: h.createdAt.toISOString(),
    })),
  });
}

export async function PUT(request: NextRequest) {
  const actor = await requireFinanceActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });
  if (!actorHasAdminRight(actor, "canManageFinance") && !actor.isGod) {
    return NextResponse.json({ error: "Only finance admins can edit fee settings." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    appleCommissionRate?: number;
    viewerCreatorSplit?: number;
    viewerPlatformSplit?: number;
    marketplaceFeeRate?: number;
    note?: string | null;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validateFinanceFeeSettingsInput(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const settings = await upsertFinanceFeeSettings({
      ...validated.values,
      note: body.note,
      updatedByUserId: actor.id,
    });
    const history = await listFinanceFeeSettingsHistory(30);
    return NextResponse.json({
      settings,
      history: history.map((h) => ({
        id: h.id,
        appleCommissionRate: h.appleCommissionRate,
        viewerCreatorSplit: h.viewerCreatorSplit,
        viewerPlatformSplit: h.viewerPlatformSplit,
        marketplaceFeeRate: h.marketplaceFeeRate,
        note: h.note,
        updatedByUserId: h.updatedByUserId,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[finance/settings] PUT", err);
    return NextResponse.json({ error: "Could not save fee settings." }, { status: 500 });
  }
}
