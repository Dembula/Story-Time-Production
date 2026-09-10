import { NextResponse } from "next/server";
import { requireExecutiveActor } from "@/lib/executive/seats";
import { writeExecutiveAudit } from "@/lib/executive/audit";
import { executiveHomePath } from "@/lib/executive/seat-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Resolve the authenticated executive's home path. */
export async function GET() {
  const actor = await requireExecutiveActor();
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error, path: null }, { status: actor.status });
  }
  await writeExecutiveAudit({
    userId: actor.userId,
    email: actor.email,
    office: actor.office,
    action: "RESOLVE_HOME",
  });
  return NextResponse.json({
    path: actor.homePath,
    office: actor.office,
    email: actor.email,
    isAdmin: actor.isAdmin,
  });
}

export function executiveFallbackHome() {
  return executiveHomePath("CEO");
}
