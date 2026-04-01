import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const base = subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date()
    ? subscription.currentPeriodEnd
    : new Date();
  const nextPeriodEnd = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.viewerSubscription.update({
    where: { id: subscription.id },
    data: {
      status: "ACTIVE",
      currentPeriodEnd: nextPeriodEnd,
      lastPaymentStatus: "DISABLED",
      lastPaymentAt: new Date(),
      lastPaymentError: null,
    },
  });

  return NextResponse.json({ success: true, renewedUntil: nextPeriodEnd.toISOString() });
}
