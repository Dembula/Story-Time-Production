import { NextRequest, NextResponse } from "next/server";
import { releaseDueMarketplaceVendorBalances } from "@/lib/payments/monthly-vendor-payout";

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return true;
  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await releaseDueMarketplaceVendorBalances();
  return NextResponse.json({ ok: true, ...result });
}
