import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requestPayoutHold } from "@/lib/payments/request-payout-hold";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { amount?: number } | null;
  const amount = Number(body?.amount ?? 0);

  const result = await requestPayoutHold({
    userId: user.id,
    role: user.role,
    amount,
    requestSource: "manual",
  });

  if (!result.ok) {
    const status =
      result.code === "VIEWER_FORBIDDEN" ||
      result.code === "REVENUE_TRACKING_PAUSED" ||
      result.code === "PAYOUT_KYC_REQUIRED" ||
      result.code === "FUNDER_VERIFICATION_REQUIRED"
        ? 403
        : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({ ok: true, payoutRequest: result.payoutRequest });
}
