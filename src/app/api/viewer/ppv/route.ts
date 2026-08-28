import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  VIEWER_MODELS,
  VIEWER_PLAN_CONFIG,
  getViewerPlaybackState,
  hasActivePpvViewerModel,
  isPpvEligibleContent,
} from "@/lib/viewer-access";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";
import { ppvTitleAccessExpiresAt } from "@/lib/pricing";

function isIosAppRequest(req: NextRequest) {
  const platform = req.headers.get("x-st-platform")?.toLowerCase() ?? "";
  const ua = req.headers.get("user-agent") ?? "";
  return platform === "ios" || /story\s*time/i.test(ua);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      {
        success: false,
        alreadyOwned: false,
        requiresPayment: false,
        checkoutUrl: null,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  const role = (session.user as { role?: string })?.role;
  if (role !== "SUBSCRIBER") {
    return NextResponse.json(
      {
        success: false,
        alreadyOwned: false,
        requiresPayment: false,
        checkoutUrl: null,
        error: "Forbidden",
      },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as { contentId?: string } | null;
  const contentId = body?.contentId?.trim();
  if (!contentId) {
    return NextResponse.json(
      {
        success: false,
        alreadyOwned: false,
        requiresPayment: false,
        checkoutUrl: null,
        error: "contentId is required",
      },
      { status: 400 },
    );
  }
  const user =
    (session.user.id
      ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } })
      : await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })) ?? null;
  if (!user?.id) {
    return NextResponse.json(
      {
        success: false,
        alreadyOwned: false,
        requiresPayment: false,
        checkoutUrl: null,
        error: "User not found",
      },
      { status: 404 },
    );
  }

  const content = await prisma.content.findUnique({
    where: { id: contentId, published: true },
    select: { id: true, title: true, type: true, videoUrl: true },
  });

  if (!content || !content.videoUrl) {
    return NextResponse.json(
      {
        success: false,
        alreadyOwned: false,
        requiresPayment: false,
        checkoutUrl: null,
        error: "Title not found",
      },
      { status: 404 },
    );
  }

  if (!isPpvEligibleContent(content.type)) {
    return NextResponse.json(
      {
        success: false,
        alreadyOwned: false,
        requiresPayment: false,
        checkoutUrl: null,
        error: "This title is not available for pay per view",
      },
      { status: 400 },
    );
  }

  const playback = await getViewerPlaybackState(user.id, content.id);
  if (playback.hasActivePpvAccess) {
    return NextResponse.json({
      success: true,
      alreadyOwned: true,
      requiresPayment: false,
      checkoutUrl: null,
      error: null,
      access: playback.contentAccess,
    });
  }

  // iOS StoreKit: open IAP; do not start PayFast.
  if (isIosAppRequest(req)) {
    return NextResponse.json({
      success: true,
      alreadyOwned: false,
      requiresPayment: true,
      checkoutUrl: null,
      error: null,
    });
  }

  if (
    !playback.subscription ||
    playback.viewerModel !== VIEWER_MODELS.PPV ||
    !hasActivePpvViewerModel(playback.subscription)
  ) {
    return NextResponse.json(
      {
        success: false,
        alreadyOwned: false,
        requiresPayment: false,
        checkoutUrl: null,
        error: "Switch this account to Pay Per View before purchasing titles",
      },
      { status: 403 },
    );
  }

  const access = await prisma.viewerContentAccess.create({
    data: {
      userId: user.id,
      contentId: content.id,
      accessType: "PPV_FILM",
      amount: VIEWER_PLAN_CONFIG.PPV_FILM.price,
      currency: "ZAR",
      status: "PENDING",
      purchasedAt: new Date(),
      expiresAt: ppvTitleAccessExpiresAt(),
    },
  });

  let checkoutUrl: string;
  try {
    const checkout = await initializeCheckout({
      userId: user.id,
      email: session.user.email ?? null,
      customerName: session.user.name ?? null,
      amount: VIEWER_PLAN_CONFIG.PPV_FILM.price,
      purpose: "viewer_ppv",
      referenceType: "ViewerContentAccess",
      referenceId: access.id,
      returnUrl: buildPaymentReturnUrl(`/browse/content/${content.id}/watch`, "viewer_ppv"),
      metadata: { contentId: content.id },
    });
    checkoutUrl = checkout.checkout.checkoutUrl;
  } catch (error) {
    await prisma.viewerContentAccess.update({
      where: { id: access.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      {
        success: false,
        alreadyOwned: false,
        requiresPayment: true,
        checkoutUrl: null,
        error: error instanceof Error ? error.message : "Unable to initialize checkout.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    requiresPayment: true,
    alreadyOwned: false,
    checkoutUrl,
    error: null,
  });
}
