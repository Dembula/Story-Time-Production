import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildStakeholderWorkspace } from "@/lib/stakeholder-ecosystem/build-workspace";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;

  if (!userId || !role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locationMode = new URL(req.url).searchParams.get("locationMode");
  const workspace = await buildStakeholderWorkspace(userId, role, {
    locationMode: locationMode === "manager" ? "manager" : "owner",
  });
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not available for this role" }, { status: 404 });
  }

  return NextResponse.json({ workspace });
}
