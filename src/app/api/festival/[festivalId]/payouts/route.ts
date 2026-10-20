import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageFestival, requireFestivalAccess, requireFestivalSession } from "@/lib/festival/access";
import { FESTIVAL_SUBMISSION_FEE_PURPOSE } from "@/lib/festival/constants";
import {
  FESTIVAL_CURATOR_SHARE,
  splitFestivalSubmissionSettlement,
} from "@/lib/festival/fee-split";
import { roundMoney } from "@/lib/payments/config";

type Ctx = { params: Promise<{ festivalId: string }> };

function readFestivalNet(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const base = (metadata as { baseAmount?: unknown }).baseAmount;
  return typeof base === "number" ? base : null;
}

/** Curator revenue: their share only — never exposes Story Time’s platform take. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { festivalId } = await ctx.params;
  const access = await requireFestivalAccess(festivalId, auth.userId, auth.role === "ADMIN");
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageFestival(access.membershipRole, auth.role === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const festival = await prisma.festival.findUnique({
    where: { id: festivalId },
    select: { id: true, name: true },
  });
  if (!festival) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const submissions = await prisma.festivalSubmission.findMany({
    where: { festivalId, paymentStatus: "PAID" },
    select: {
      id: true,
      title: true,
      feeAmountZar: true,
      paymentRecordId: true,
      submittedAt: true,
      paymentStatus: true,
      category: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true, email: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const paymentIds = submissions.map((s) => s.paymentRecordId).filter(Boolean) as string[];
  const submissionIds = submissions.map((s) => s.id);
  const [payments, batches] = await Promise.all([
    paymentIds.length
      ? prisma.paymentRecord.findMany({
          where: {
            id: { in: paymentIds },
            purpose: FESTIVAL_SUBMISSION_FEE_PURPOSE,
            status: "SUCCEEDED",
          },
          select: {
            id: true,
            amount: true,
            settlementAmount: true,
            paidAt: true,
            status: true,
            provider: true,
          },
        })
      : Promise.resolve([]),
    submissionIds.length
      ? prisma.ledgerBatch.findMany({
          where: { referenceType: "FestivalSubmission", referenceId: { in: submissionIds } },
          select: { referenceId: true, metadata: true },
        })
      : Promise.resolve([]),
  ]);

  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const batchBySubmission = new Map(batches.map((b) => [b.referenceId, b]));

  const receipts = submissions.map((s) => {
    const payment = s.paymentRecordId ? paymentById.get(s.paymentRecordId) : null;
    const settlement = payment?.settlementAmount ?? payment?.amount ?? s.feeAmountZar;
    const fromLedger = readFestivalNet(batchBySubmission.get(s.id)?.metadata);
    const yourEarningsZar =
      fromLedger ?? splitFestivalSubmissionSettlement(settlement).festivalNetZar;
    const paidAt = payment?.paidAt ?? s.submittedAt;
    return {
      receiptId: payment?.id ?? s.id,
      submissionId: s.id,
      filmTitle: s.title,
      categoryName: s.category.name,
      filmmakerName: s.creator.name || "Filmmaker",
      filmmakerEmail: s.creator.email,
      submissionFeeZar: roundMoney(s.feeAmountZar),
      yourEarningsZar: roundMoney(yourEarningsZar),
      paidAt,
      paymentStatus: payment?.status ?? s.paymentStatus,
      remittanceStatus: "HELD_FOR_REMITTANCE" as const,
      paymentProvider: payment?.provider ?? null,
    };
  });

  const yourRevenueZar = roundMoney(
    receipts.reduce((sum, r) => sum + (r.yourEarningsZar || 0), 0),
  );
  const curatorPct = Math.round(FESTIVAL_CURATOR_SHARE * 100);

  return NextResponse.json({
    festival: { id: festival.id, name: festival.name },
    receipts,
    summary: {
      paidSubmissionCount: receipts.length,
      yourRevenueZar,
      curatorSharePercent: curatorPct,
      note: `You earn ${curatorPct}% of each paid submission fee. Amounts below are your share, held for remittance.`,
    },
  });
}
