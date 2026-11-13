import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  FESTIVAL_SUBMISSION_FEE_PURPOSE,
  isFestivalFeePayable,
  normalizeFestivalFeeZar,
} from "@/lib/festival/constants";
import { festivalSubmissionHasSuccessfulPayment } from "@/lib/festival/payment";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";

type Ctx = { params: Promise<{ submissionId: string }> };

/**
 * POST /api/creator/festivals/submissions/[submissionId]/pay
 * Resume PayFast checkout for a festival entry stuck in AWAITING_PAYMENT
 * (abandoned gateway, cancelled payment, or failed init).
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const email = session?.user?.email;
  const name = session?.user?.name;
  if (!userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { submissionId } = await ctx.params;
  const id = submissionId?.trim();
  if (!id) return NextResponse.json({ error: "submissionId required" }, { status: 400 });

  const submission = await prisma.festivalSubmission.findFirst({
    where: role === "ADMIN" ? { id } : { id, creatorUserId: userId },
    include: {
      festival: { select: { id: true, name: true, status: true } },
      category: { select: { id: true, name: true } },
    },
  });
  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (await festivalSubmissionHasSuccessfulPayment(submission.id)) {
    const paid = await prisma.festivalSubmission.update({
      where: { id: submission.id },
      data: {
        paymentStatus: "PAID",
        submittedAt: submission.submittedAt ?? new Date(),
      },
    });
    return NextResponse.json({
      submission: paid,
      requiresPayment: false,
      alreadyPaid: true,
      checkoutUrl: null,
    });
  }

  if (submission.paymentStatus === "PAID") {
    return NextResponse.json({
      submission,
      requiresPayment: false,
      alreadyPaid: true,
      checkoutUrl: null,
    });
  }

  const feeAmountZar = normalizeFestivalFeeZar(submission.feeAmountZar);
  // PayFast rejects R0 — heal free entries to PAID without touching the gateway.
  if (!isFestivalFeePayable(feeAmountZar)) {
    const free = await prisma.festivalSubmission.update({
      where: { id: submission.id },
      data: {
        feeAmountZar: 0,
        paymentStatus: "PAID",
        submittedAt: submission.submittedAt ?? new Date(),
      },
    });
    return NextResponse.json({
      submission: free,
      requiresPayment: false,
      checkoutUrl: null,
      feeAmountZar: 0,
    });
  }

  if (submission.paymentStatus !== "AWAITING_PAYMENT") {
    return NextResponse.json(
      {
        error: `Payment can only be resumed when status is Awaiting payment (currently ${submission.paymentStatus}).`,
      },
      { status: 409 },
    );
  }

  // Final guard: never hand a non-positive amount to PayFast.
  if (!isFestivalFeePayable(feeAmountZar)) {
    return NextResponse.json({
      submission,
      requiresPayment: false,
      checkoutUrl: null,
      feeAmountZar: 0,
    });
  }

  try {
    const checkout = await initializeCheckout({
      userId: submission.creatorUserId,
      email,
      customerName: name,
      amount: feeAmountZar,
      purpose: FESTIVAL_SUBMISSION_FEE_PURPOSE,
      referenceType: "FestivalSubmission",
      referenceId: submission.id,
      returnUrl: buildPaymentReturnUrl(
        `/creator/festivals/submissions?paid=${submission.id}`,
        "festival_submission",
      ),
      metadata: {
        festivalId: submission.festivalId,
        festivalName: submission.festival?.name,
        categoryId: submission.categoryId,
        fundingSource: "festival_submission_fee",
        resume: true,
      },
    });

    return NextResponse.json({
      submission,
      requiresPayment: true,
      checkoutUrl: checkout.checkout.checkoutUrl,
      paymentRecordId: checkout.paymentRecord.id,
      feeAmountZar,
    });
  } catch (err) {
    console.error("festival submission pay-resume failed", err);
    return NextResponse.json(
      { error: "Could not start payment. Please try again.", submissionId: submission.id },
      { status: 500 },
    );
  }
}
