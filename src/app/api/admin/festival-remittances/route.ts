import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FESTIVAL_SUBMISSION_FEE_PURPOSE } from "@/lib/festival/constants";
import {
  FESTIVAL_CURATOR_SHARE,
  FESTIVAL_PLATFORM_SHARE,
  splitFestivalSubmissionSettlement,
} from "@/lib/festival/fee-split";
import { roundMoney } from "@/lib/payments/config";

function readBatchSplit(metadata: unknown): { platformFeeZar: number; festivalNetZar: number } | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as { feeAmount?: unknown; baseAmount?: unknown };
  const fee = typeof m.feeAmount === "number" ? m.feeAmount : null;
  const base = typeof m.baseAmount === "number" ? m.baseAmount : null;
  if (fee == null || base == null) return null;
  return { platformFeeZar: fee, festivalNetZar: base };
}

/** Admin view: festival submission fees — platform % is ST revenue; net held for festival remittance. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payments = await prisma.paymentRecord.findMany({
    where: {
      purpose: FESTIVAL_SUBMISSION_FEE_PURPOSE,
      status: "SUCCEEDED",
      relatedEntityType: "FestivalSubmission",
    },
    orderBy: { paidAt: "desc" },
    take: 200,
    select: {
      id: true,
      amount: true,
      settlementAmount: true,
      paidAt: true,
      relatedEntityId: true,
      userId: true,
    },
  });

  const submissionIds = payments.map((p) => p.relatedEntityId).filter(Boolean) as string[];
  const [submissions, batches] = await Promise.all([
    submissionIds.length
      ? prisma.festivalSubmission.findMany({
          where: { id: { in: submissionIds } },
          select: {
            id: true,
            title: true,
            feeAmountZar: true,
            festival: {
              select: {
                id: true,
                name: true,
                ownerUserId: true,
                owner: { select: { email: true, name: true } },
              },
            },
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
  const byId = new Map(submissions.map((s) => [s.id, s]));
  const batchBySubmission = new Map(batches.map((b) => [b.referenceId, b]));

  const rows = payments.map((p) => {
    const sub = p.relatedEntityId ? byId.get(p.relatedEntityId) : null;
    const settlement = p.settlementAmount ?? p.amount;
    const fromLedger = p.relatedEntityId
      ? readBatchSplit(batchBySubmission.get(p.relatedEntityId)?.metadata)
      : null;
    const split = fromLedger ?? splitFestivalSubmissionSettlement(settlement);
    return {
      paymentId: p.id,
      amount: p.amount,
      settlementAmountZar: roundMoney(settlement),
      platformFeeZar: split.platformFeeZar,
      festivalNetZar: split.festivalNetZar,
      paidAt: p.paidAt,
      submissionTitle: sub?.title ?? null,
      festivalName: sub?.festival.name ?? null,
      festivalOwnerEmail: sub?.festival.owner.email ?? null,
      remittanceStatus: "HELD_FOR_FESTIVAL",
    };
  });

  const gross = rows.reduce((sum, r) => sum + (r.settlementAmountZar || 0), 0);
  const platformTake = rows.reduce((sum, r) => sum + (r.platformFeeZar || 0), 0);
  const festivalNet = rows.reduce((sum, r) => sum + (r.festivalNetZar || 0), 0);
  const platformPct = Math.round(FESTIVAL_PLATFORM_SHARE * 100);
  const curatorPct = Math.round(FESTIVAL_CURATOR_SHARE * 100);

  return NextResponse.json({
    rows,
    summary: {
      count: rows.length,
      grossHeldZar: roundMoney(gross),
      platformRevenueZar: roundMoney(platformTake),
      netOwedToFestivalsZar: roundMoney(festivalNet),
      platformSharePercent: platformPct,
      curatorSharePercent: curatorPct,
      note: `Split is ${curatorPct}% festival / ${platformPct}% Story Time on submission settlements. Festival remittance is out-of-band.`,
    },
  });
}
