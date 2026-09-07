import { NextRequest, NextResponse } from "next/server";
import { actorHasAdminRight, requireAdminApiActor } from "@/lib/admin-api-auth";
import { fetchFinanceOverviewBundle } from "@/lib/finance/overview-bundle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function requireFinanceOrRevenueActor() {
  const actor = await requireAdminApiActor();
  if ("error" in actor) return actor;
  if (
    !actorHasAdminRight(actor, "canManageFinance") &&
    !actorHasAdminRight(actor, "canManageRevenue") &&
    !actor.isGod
  ) {
    return { error: "Forbidden", status: 403 as const };
  }
  return actor;
}

export async function GET(request: NextRequest) {
  const actor = await requireFinanceOrRevenueActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const { searchParams } = request.nextUrl;
  try {
    const bundle = await fetchFinanceOverviewBundle({
      period: searchParams.get("period"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      sheetLimit: Number(searchParams.get("limit") || 200),
    });
    return NextResponse.json(bundle);
  } catch (err) {
    console.error("[finance/overview]", err);
    return NextResponse.json({ error: "Could not load finance overview." }, { status: 500 });
  }
}
