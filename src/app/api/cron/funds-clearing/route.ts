import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronCall } from "@/lib/cron-auth";
import { processDueFundsClearing } from "@/lib/payments/funds-clearing";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueFundsClearing();
  return NextResponse.json({ ok: true, ...result });
}
