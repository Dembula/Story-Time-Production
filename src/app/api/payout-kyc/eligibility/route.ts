import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  hasCompletedPackagePaymentForPayoutKyc,
  isPayoutKycDashboardPath,
} from "@/lib/payout-kyc-eligibility";
import { requiresPayoutKyc } from "@/lib/payout-kyc";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string })?.role;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!requiresPayoutKyc(role)) {
    return NextResponse.json({
      showPrompt: false,
      packagePaid: false,
      onDashboard: false,
    });
  }

  const pathname = req.nextUrl.searchParams.get("pathname") ?? "";
  const onDashboard = isPayoutKycDashboardPath(pathname, role);
  const packagePaid = await hasCompletedPackagePaymentForPayoutKyc(userId, role);
  // Unfinished-KYC reminder is wallet-only (even before package payment).
  const onWallet = pathname.includes("/wallet");

  return NextResponse.json({
    showPrompt: onWallet || (onDashboard && packagePaid),
    packagePaid,
    onDashboard,
    onWallet,
  });
}
