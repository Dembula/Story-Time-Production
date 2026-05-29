import { NextRequest, NextResponse } from "next/server";
import { runDueCreatorPoolDistributions } from "@/lib/payments/creator-pool-distribution";

function isAuthorizedCronCall(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runDueCreatorPoolDistributions();
  return NextResponse.json({ ok: true, results });
}
