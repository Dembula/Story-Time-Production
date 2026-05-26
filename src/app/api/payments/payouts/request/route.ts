import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { ensureWalletForUser } from "@/lib/payments/wallet";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { toGatewaySafeReference } from "@/lib/payments/reference";
import { assertFunderVerificationApproved } from "@/lib/funder-verification";
import { assertPayoutKycApproved, requiresPayoutKyc } from "@/lib/payout-kyc";
const db = prisma as any;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "SUBSCRIBER") return NextResponse.json({ error: "Viewers cannot request payouts." }, { status: 403 });

  if (user.role === "FUNDER") {
    const funderCheck = await assertFunderVerificationApproved(user.id);
    if (!funderCheck.ok) {
      return NextResponse.json({ error: funderCheck.error, code: funderCheck.code }, { status: 403 });
    }
  } else if (requiresPayoutKyc(user.role)) {
    const kycCheck = await assertPayoutKycApproved(user.id);
    if (!kycCheck.ok) {
      return NextResponse.json({ error: kycCheck.error, code: "PAYOUT_KYC_REQUIRED" }, { status: 403 });
    }
  }

  const body = (await req.json().catch(() => null)) as { amount?: number; beneficiaryToken?: string } | null;
  const amount = Number(body?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Valid amount is required." }, { status: 400 });
  }
  if (!body?.beneficiaryToken) {
    return NextResponse.json({ error: "beneficiaryToken is required." }, { status: 400 });
  }

  const wallet = await ensureWalletForUser(user.id);
  if (wallet.availableBalance < amount) {
    return NextResponse.json({ error: "Insufficient available balance." }, { status: 400 });
  }

  const gateway = getPaymentGateway();
  let payout: Awaited<ReturnType<typeof gateway.requestPayout>>;
  try {
    payout = await gateway.requestPayout({
      amount,
      currency: "ZAR",
      reference: toGatewaySafeReference("payout", `${user.id}-${Date.now()}`),
      beneficiaryToken: body.beneficiaryToken,
      metadata: { userId: user.id },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to request payout." },
      { status: 502 },
    );
  }

  const payoutRequest = await db.payoutRequest.create({
    data: {
      userId: user.id,
      walletId: wallet.id,
      amount,
      currency: "ZAR",
      provider: payout.provider,
      providerReference: payout.externalRef,
      status: payout.status === "PROCESSING" ? "PROCESSING" : "FAILED",
    },
  });

  await postBalancedLedgerBatch({
    idempotencyKey: `payout_request_${payoutRequest.id}`,
    referenceType: "PAYOUT_REQUEST",
    referenceId: payoutRequest.id,
    entries: [
      {
        userId: user.id,
        direction: "DEBIT",
        accountType: "AVAILABLE",
        transactionType: "withdrawal",
        amount,
      },
      {
        userId: user.id,
        direction: "CREDIT",
        accountType: "PENDING",
        transactionType: "withdrawal",
        amount,
      },
    ],
  });

  await db.wallet.update({
    where: { id: wallet.id },
    data: { totalWithdrawn: { increment: amount } },
  });

  return NextResponse.json({ ok: true, payoutRequest });
}
