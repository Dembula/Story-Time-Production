import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processViewerSubscriptionCharge } from "@/lib/payments/subscription-billing";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await prisma.viewerSubscription.findFirst({
    where: { user: { email: session.user.email }, viewerModel: "SUBSCRIPTION" },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }

  const charge = await processViewerSubscriptionCharge(subscription.id);
  if (!charge.ok) {
    return NextResponse.json(
      { error: "Unable to process renewal with saved card.", reason: charge.reason },
      { status: 402 },
    );
  }
  const updated = await prisma.viewerSubscription.findUnique({
    where: { id: subscription.id },
    select: { currentPeriodEnd: true },
  });
  return NextResponse.json({ success: true, renewedUntil: updated?.currentPeriodEnd?.toISOString() ?? null });
}
