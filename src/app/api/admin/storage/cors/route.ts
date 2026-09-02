import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiActor, actorHasAdminRight } from "@/lib/admin-api-auth";
import { ensureStorageBucketCors, resolveStorageCorsOrigins } from "@/lib/storage-cors";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Admin: inspect / force-apply media bucket CORS for catalogue uploads. */
export async function GET() {
  const actor = await requireAdminApiActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });
  if (!actorHasAdminRight(actor, "canManageSystem") && !actor.isGod) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await ensureStorageBucketCors({ force: false });
  return NextResponse.json({
    ok: result.ok,
    applied: result.applied,
    bucket: result.bucket,
    origins: result.origins,
    expectedOrigins: resolveStorageCorsOrigins(),
    error: result.error ?? null,
    rules: result.rules ?? null,
  });
}

export async function POST(request: NextRequest) {
  const actor = await requireAdminApiActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });
  if (!actorHasAdminRight(actor, "canManageSystem") && !actor.isGod) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { force?: boolean } | null;
  const result = await ensureStorageBucketCors({ force: body?.force !== false });
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        bucket: result.bucket,
        origins: result.origins,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    applied: result.applied,
    bucket: result.bucket,
    origins: result.origins,
    rules: result.rules ?? null,
  });
}
