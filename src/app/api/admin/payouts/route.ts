import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postBalancedLedgerBatch } from "@/lib/payments/ledger";
import { getPlatformTreasuryUserId } from "@/lib/payments/treasury-inflow";

const db = prisma as any;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "ADMIN") {
    return { adminId: null as string | null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { adminId: user.id, error: null as NextResponse | null };
}

export async function GET(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const status = req.nextUrl.searchParams.get("status");
  const limit = Math.min(200, Number(req.nextUrl.searchParams.get("limit") ?? "100"));

  const payouts = await db.payoutRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          creatorBanking: { select: { bankName: true, accountNumber: true, accountType: true, branchCode: true } },
          payoutKycProfile: { select: { kycData: true, verificationStatus: true } },
          funderProfile: { select: { kycData: true } },
        },
      },
      wallet: { select: { availableBalance: true, pendingBalance: true } },
    },
  });

  return NextResponse.json({ payouts });
}

export async function PATCH(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id?: string;
        action?: "approve" | "decline" | "mark_paid";
        declineReason?: string;
        adminNotes?: string;
        proofUrl?: string;
        proofReference?: string;
      }
    | null;

  if (!body?.id || !body.action) {
    return NextResponse.json({ error: "id and action are required." }, { status: 400 });
  }

  const payout = await db.payoutRequest.findUnique({
    where: { id: body.id },
    include: { user: { select: { id: true } } },
  });
  if (!payout) return NextResponse.json({ error: "Payout not found." }, { status: 404 });

  const now = new Date();

  if (body.action === "approve") {
    if (!["PENDING_REVIEW", "PROCESSING"].includes(payout.status)) {
      return NextResponse.json({ error: "Only pending requests can be approved." }, { status: 409 });
    }
    const updated = await db.payoutRequest.update({
      where: { id: payout.id },
      data: {
        status: "APPROVED",
        reviewedById: access.adminId,
        reviewedAt: now,
        adminNotes: body.adminNotes ?? payout.adminNotes,
      },
    });
    return NextResponse.json({ ok: true, payout: updated });
  }

  if (body.action === "decline") {
    if (!["PENDING_REVIEW", "APPROVED", "PROCESSING"].includes(payout.status)) {
      return NextResponse.json({ error: "This payout cannot be declined." }, { status: 409 });
    }
    if (!body.declineReason?.trim()) {
      return NextResponse.json({ error: "declineReason is required." }, { status: 400 });
    }

    await postBalancedLedgerBatch({
      idempotencyKey: `payout_decline_${payout.id}`,
      referenceType: "PAYOUT_REQUEST",
      referenceId: payout.id,
      entries: [
        {
          userId: payout.userId,
          direction: "DEBIT",
          accountType: "PENDING",
          transactionType: "withdrawal_release",
          amount: payout.amount,
          description: "Payout declined — funds returned to available balance",
        },
        {
          userId: payout.userId,
          direction: "CREDIT",
          accountType: "AVAILABLE",
          transactionType: "withdrawal_release",
          amount: payout.amount,
        },
      ],
    });

    const updated = await db.payoutRequest.update({
      where: { id: payout.id },
      data: {
        status: "DECLINED",
        declineReason: body.declineReason.trim(),
        adminNotes: body.adminNotes ?? payout.adminNotes,
        reviewedById: access.adminId,
        reviewedAt: now,
      },
    });
    return NextResponse.json({ ok: true, payout: updated });
  }

  if (body.action === "mark_paid") {
    if (!["APPROVED", "PROCESSING"].includes(payout.status)) {
      return NextResponse.json({ error: "Payout must be approved before marking paid." }, { status: 409 });
    }
    if (!body.proofReference?.trim() && !body.proofUrl?.trim()) {
      return NextResponse.json({ error: "proofReference or proofUrl is required." }, { status: 400 });
    }

    const treasuryUserId = await getPlatformTreasuryUserId();

    await postBalancedLedgerBatch({
      idempotencyKey: `payout_paid_${payout.id}`,
      referenceType: "PAYOUT_REQUEST",
      referenceId: payout.id,
      metadata: {
        proofReference: body.proofReference?.trim() ?? null,
        proofUrl: body.proofUrl?.trim() ?? null,
      },
      entries: [
        {
          userId: payout.userId,
          direction: "DEBIT",
          accountType: "PENDING",
          transactionType: "withdrawal_completed",
          amount: payout.amount,
          description: "Manual payout completed",
        },
        {
          userId: treasuryUserId,
          direction: "DEBIT",
          accountType: "AVAILABLE",
          transactionType: "manual_payout",
          amount: payout.amount,
          description: "Manual EFT payout to user bank account",
        },
        {
          userId: treasuryUserId,
          direction: "CREDIT",
          accountType: "LOCKED",
          transactionType: "manual_payout_balance",
          amount: payout.amount * 2,
          description: "Payout ledger balance",
        },
      ],
    });

    await db.wallet.update({
      where: { id: payout.walletId },
      data: { totalWithdrawn: { increment: payout.amount } },
    });

    const updated = await db.payoutRequest.update({
      where: { id: payout.id },
      data: {
        status: "PAID",
        paidAt: now,
        proofUrl: body.proofUrl?.trim() || payout.proofUrl,
        proofReference: body.proofReference?.trim() || payout.proofReference,
        adminNotes: body.adminNotes ?? payout.adminNotes,
        reviewedById: access.adminId,
        reviewedAt: now,
      },
    });
    return NextResponse.json({ ok: true, payout: updated });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}
