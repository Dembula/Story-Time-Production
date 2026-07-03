import { NextRequest, NextResponse } from "next/server";
import { runDueCreatorPoolDistributions } from "@/lib/payments/creator-pool-distribution";
import { isAuthorizedCronCall } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runDueCreatorPoolDistributions();
  return NextResponse.json({ ok: true, results });
}
