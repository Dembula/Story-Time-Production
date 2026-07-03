import { NextRequest, NextResponse } from "next/server";
import { releaseDueMarketplaceVendorBalances } from "@/lib/payments/monthly-vendor-payout";
import { isAuthorizedCronCall } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await releaseDueMarketplaceVendorBalances();
  return NextResponse.json({ ok: true, ...result });
}
