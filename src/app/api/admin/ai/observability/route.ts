import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchAiAdminDashboardBundle } from "@/lib/ai-os/observability/admin-bundle";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const hoursRaw = url.searchParams.get("hours");
  const windowHours = hoursRaw ? Math.min(168, Math.max(1, parseInt(hoursRaw, 10))) : 24;

  const body = await fetchAiAdminDashboardBundle(windowHours);
  return NextResponse.json(body);
}
