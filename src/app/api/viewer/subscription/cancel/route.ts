import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cancelViewerSubscription,
  resumeViewerSubscription,
} from "@/lib/payments/subscription-billing";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { action?: "cancel" | "resume"; cancelAtPeriodEnd?: boolean }
    | null;

  if (body?.action === "resume") {
    const result = await resumeViewerSubscription(session.user.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true, subscription: result.subscription });
  }

  const cancelAtPeriodEnd = body?.cancelAtPeriodEnd !== false;
  const result = await cancelViewerSubscription({
    userId: session.user.id,
    cancelAtPeriodEnd,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({
    ok: true,
    subscription: result.subscription,
    immediate: result.immediate ?? false,
    message: result.immediate
      ? "Subscription cancelled immediately."
      : "Subscription will end at the close of your current billing period. You keep access until then.",
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await prisma.viewerSubscription.findFirst({
    where: { userId: session.user.id, viewerModel: "SUBSCRIPTION" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      plan: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      renewalAttemptCount: true,
      pastDueSince: true,
      lastPaymentStatus: true,
      lastPaymentError: true,
    },
  });

  return NextResponse.json({ subscription });
}
