import { NextRequest, NextResponse } from "next/server";
import { processDueViewerBilling } from "@/lib/payments/subscription-billing";
import { processDueCompanySubscriptions } from "@/lib/payments/company-subscription-billing";
import { processDueCreatorLicenseRenewals } from "@/lib/payments/creator-license-billing";
import { isAuthorizedCronCall } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [viewer, company, creatorLicenses] = await Promise.all([
    processDueViewerBilling(),
    processDueCompanySubscriptions(),
    processDueCreatorLicenseRenewals(),
  ]);

  return NextResponse.json({
    ok: true,
    viewer,
    company,
    creatorLicenses,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
