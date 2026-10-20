import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  feeForTier,
  festivalAcceptsSubmissions,
  FESTIVAL_SUBMISSION_FEE_PURPOSE,
  resolveDeadlineTier,
} from "@/lib/festival/constants";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import { createUniverseHoldContent } from "@/lib/festival/universe-hold";
import { festivalSubmissionHasSuccessfulPayment } from "@/lib/festival/payment";

type Ctx = { params: Promise<{ festivalId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;
  const email = session?.user?.email;
  const name = session?.user?.name;
  if (!userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { festivalId } = await ctx.params;
  const festival = await prisma.festival.findFirst({
    where: { OR: [{ id: festivalId }, { slug: festivalId }] },
    include: { categories: true },
  });
  if (!festival) return NextResponse.json({ error: "Festival not found." }, { status: 404 });
  if (!festivalAcceptsSubmissions(festival)) {
    return NextResponse.json({ error: "This festival is not accepting submissions." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const category = festival.categories.find((c) => c.id === categoryId);
  if (!category) return NextResponse.json({ error: "Select a valid category." }, { status: 400 });

  const tier = resolveDeadlineTier(festival);
  const feeAmountZar = feeForTier(category, tier);
  const universeOptIn = Boolean(body.universeOptIn);
  const stillUrls = Array.isArray(body.stillUrls)
    ? body.stillUrls.filter((u: unknown) => typeof u === "string")
    : [];

  const submission = await prisma.festivalSubmission.create({
    data: {
      festivalId: festival.id,
      categoryId: category.id,
      creatorUserId: userId,
      title,
      logline: typeof body.logline === "string" ? body.logline.trim() : null,
      synopsis: typeof body.synopsis === "string" ? body.synopsis.trim() : null,
      formPayload: body.formPayload ?? {
        contact: body.contact ?? null,
        credits: body.credits ?? null,
        specifications: body.specifications ?? null,
      },
      screenerUrl: typeof body.screenerUrl === "string" ? body.screenerUrl.trim() : null,
      trailerUrl: typeof body.trailerUrl === "string" ? body.trailerUrl.trim() : null,
      stillUrls,
      feeAmountZar,
      paymentStatus: feeAmountZar > 0 ? "AWAITING_PAYMENT" : "PAID",
      universeOptIn,
      submittedAt: feeAmountZar > 0 ? null : new Date(),
    },
  });

  if (universeOptIn) {
    await createUniverseHoldContent({
      creatorUserId: userId,
      festivalId: festival.id,
      submissionId: submission.id,
      title,
      description: typeof body.synopsis === "string" ? body.synopsis : null,
      screenerUrl: submission.screenerUrl,
      trailerUrl: submission.trailerUrl,
      stillUrl: stillUrls[0] ?? null,
    });
  }

  if (feeAmountZar <= 0) {
    return NextResponse.json({
      submission,
      requiresPayment: false,
      checkoutUrl: null,
    });
  }

  if (await festivalSubmissionHasSuccessfulPayment(submission.id)) {
    await prisma.festivalSubmission.update({
      where: { id: submission.id },
      data: { paymentStatus: "PAID", submittedAt: new Date() },
    });
    return NextResponse.json({ submission, requiresPayment: false, checkoutUrl: null });
  }

  try {
    const checkout = await initializeCheckout({
      userId,
      email,
      customerName: name,
      amount: feeAmountZar,
      purpose: FESTIVAL_SUBMISSION_FEE_PURPOSE,
      referenceType: "FestivalSubmission",
      referenceId: submission.id,
      returnUrl: buildPaymentReturnUrl(`/creator/festivals/submissions?paid=${submission.id}`, "festival_submission"),
      metadata: {
        festivalId: festival.id,
        festivalName: festival.name,
        categoryId: category.id,
        fundingSource: "festival_submission_fee",
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
    console.error("festival submission checkout failed", err);
    return NextResponse.json(
      { error: "Could not start payment. Please try again.", submissionId: submission.id },
      { status: 500 },
    );
  }
}
