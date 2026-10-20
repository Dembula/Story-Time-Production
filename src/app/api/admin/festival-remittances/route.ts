import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FESTIVAL_SUBMISSION_FEE_PURPOSE } from "@/lib/festival/constants";

/** Admin view: festival submission fees held for remittance (not ST service revenue). */
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
  const submissions = submissionIds.length
    ? await prisma.festivalSubmission.findMany({
        where: { id: { in: submissionIds } },
        select: {
          id: true,
          title: true,
          feeAmountZar: true,
          festival: { select: { id: true, name: true, ownerUserId: true, owner: { select: { email: true, name: true } } } },
        },
      })
    : [];
  const byId = new Map(submissions.map((s) => [s.id, s]));

  const rows = payments.map((p) => {
    const sub = p.relatedEntityId ? byId.get(p.relatedEntityId) : null;
    return {
      paymentId: p.id,
      amount: p.amount,
      paidAt: p.paidAt,
      submissionTitle: sub?.title ?? null,
      festivalName: sub?.festival.name ?? null,
      festivalOwnerEmail: sub?.festival.owner.email ?? null,
      remittanceStatus: "HELD_FOR_FESTIVAL",
    };
  });

  const gross = rows.reduce((sum, r) => sum + (r.amount || 0), 0);

  return NextResponse.json({
    rows,
    summary: {
      count: rows.length,
      grossHeldZar: Math.round(gross * 100) / 100,
      note: "Collected via Story Time PayFast; remit to festivals out-of-band. Excluded from platform service revenue.",
    },
  });
}
