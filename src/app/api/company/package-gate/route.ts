import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasCompletedPackagePaymentForPayoutKyc } from "@/lib/payout-kyc-eligibility";
import { isCompanyRole } from "@/lib/company-package-gate";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCompanyRole(role)) {
    return NextResponse.json({ packageComplete: true });
  }

  const packageComplete = await hasCompletedPackagePaymentForPayoutKyc(userId, role);
  return NextResponse.json({ packageComplete });
}
