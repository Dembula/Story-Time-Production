import { NextResponse } from "next/server";
import { requireExecutiveActor } from "@/lib/executive/seats";
import { fetchExecutiveDataBundle } from "@/lib/executive/bundle";
import { writeExecutiveAudit } from "@/lib/executive/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireExecutiveActor();
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const bundle = await fetchExecutiveDataBundle(actor.office);
  await writeExecutiveAudit({
    userId: actor.userId,
    email: actor.email,
    office: actor.office,
    action: "VIEW_SUMMARY",
    entityType: "ExecutiveDataBundle",
  });

  return NextResponse.json({
    actor: {
      email: actor.email,
      office: actor.office,
      name: actor.name,
      isAdmin: actor.isAdmin,
      homePath: actor.homePath,
    },
    ...bundle,
  });
}
