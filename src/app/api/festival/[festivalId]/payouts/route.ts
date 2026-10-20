import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageFestival, requireFestivalAccess, requireFestivalSession } from "@/lib/festival/access";
import { FESTIVAL_SUBMISSION_FEE_PURPOSE } from "@/lib/festival/constants";

type Ctx = { params: Promise<{ festivalId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { festivalId } = await ctx.params;
  const access = await requireFestivalAccess(festivalId, auth.userId, auth.role === "ADMIN");
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageFestival(access.membershipRole, auth.role === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submissions = await prisma.festivalSubmission.findMany({
    where: { festivalId, paymentStatus: "PAID" },
    select: {
      id: true,
      title: true,
      feeAmountZar: true,
      paymentRecordId: true,
      submittedAt: true,
      creator: { select: { name: true, email: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const paymentIds = submissions.map((s) => s.paymentRecordId).filter(Boolean) as string[];
  const payments = paymentIds.length
    ? await prisma.paymentRecord.findMany({
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
        },
      })
    : [];

  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const rows = submissions.map((s) => {
    const payment = s.paymentRecordId ? paymentById.get(s.paymentRecordId) : null;
    return {
      submissionId: s.id,
      title: s.title,
      creatorName: s.creator.name,
      creatorEmail: s.creator.email,
      feeAmountZar: s.feeAmountZar,
      paidAt: payment?.paidAt ?? s.submittedAt,
      paymentStatus: payment?.status ?? "SUCCEEDED",
      remittanceStatus: "HELD_FOR_FESTIVAL" as const,
    };
  });

  const gross = rows.reduce((sum, r) => sum + (r.feeAmountZar || 0), 0);

  return NextResponse.json({
    rows,
    summary: {
      paidSubmissionCount: rows.length,
      grossFeesZar: Math.round(gross * 100) / 100,
      netOwedToFestivalZar: Math.round(gross * 100) / 100,
      note: "Fees are collected by Story Time via PayFast and held for remittance to your festival. Not counted as Story Time service revenue.",
    },
  });
}
