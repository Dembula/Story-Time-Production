import { NextResponse } from "next/server";
import { requireAdminApiPath } from "@/lib/admin-api-auth";
import { getAdminContentEngagementInsights } from "@/lib/admin/content-engagement-insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireAdminApiPath("/api/admin/content");
  if ("error" in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { id } = await params;
  const insights = await getAdminContentEngagementInsights(id);
  if (!insights) {
    return NextResponse.json({ error: "Content not found" }, { status: 404 });
  }

  return NextResponse.json(insights);
}
