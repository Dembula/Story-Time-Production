import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  contentHasSuccessfulUploadPayment,
  creatorNeedsPerFilmUploadPayment,
  initializeCreatorFilmUploadCheckout,
} from "@/lib/creator-film-upload-payment";

type RouteCtx = { params: Promise<{ contentId: string }> };

/**
 * POST /api/creator/content/[contentId]/pay-upload
 * Resume checkout for a title stuck in AWAITING_PAYMENT (abandoned or failed gateway init).
 */
export async function POST(_req: NextRequest, ctx: RouteCtx) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { contentId } = await ctx.params;
  const id = contentId?.trim();
  if (!id) {
    return NextResponse.json({ error: "contentId required" }, { status: 400 });
  }

  const userId = session!.user!.id as string;
  const content = await prisma.content.findFirst({
    where: role === "ADMIN" ? { id } : { id, creatorId: userId },
    select: {
      id: true,
      title: true,
      type: true,
      reviewStatus: true,
      creatorId: true,
    },
  });

  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (content.reviewStatus !== "AWAITING_PAYMENT") {
    return NextResponse.json(
      {
        error:
          content.reviewStatus === "PENDING" || content.reviewStatus === "APPROVED"
            ? "This title is already past payment."
            : `Payment can only be started when status is Awaiting payment (currently ${content.reviewStatus}).`,
      },
      { status: 409 },
    );
  }

  const owner = await prisma.user.findUnique({
    where: { id: content.creatorId },
    select: {
      creatorDistributionLicense: { select: { type: true } },
    },
  });
  const licenseType = owner?.creatorDistributionLicense?.type;
  if (!licenseType || !creatorNeedsPerFilmUploadPayment(licenseType)) {
    const submitted = await prisma.content.update({
      where: { id: content.id },
      data: { reviewStatus: "PENDING", submittedAt: new Date() },
    });
    return NextResponse.json({
      ...submitted,
      requiresPayment: false,
      alreadyCovered: true,
    });
  }

  if (await contentHasSuccessfulUploadPayment(content.id)) {
    const submitted = await prisma.content.update({
      where: { id: content.id },
      data: { reviewStatus: "PENDING", submittedAt: new Date() },
    });
    return NextResponse.json({
      ...submitted,
      requiresPayment: false,
      alreadyPaid: true,
    });
  }

  const payer = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  try {
    const checkout = await initializeCreatorFilmUploadCheckout({
      userId,
      email: payer?.email,
      customerName: payer?.name,
      contentId: content.id,
      contentTitle: content.title,
      contentType: content.type,
    });
    return NextResponse.json({
      id: content.id,
      reviewStatus: "AWAITING_PAYMENT",
      requiresPayment: true,
      checkoutUrl: checkout.checkoutUrl,
      paymentRecordId: checkout.paymentRecordId,
      uploadFee: checkout.amount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initialize checkout.";
    return NextResponse.json(
      {
        error: message,
        contentId: content.id,
        reviewStatus: "AWAITING_PAYMENT",
        code: "PAYMENT_GATEWAY_UNAVAILABLE",
      },
      { status: 502 },
    );
  }
}
