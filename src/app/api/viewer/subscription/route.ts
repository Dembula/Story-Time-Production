import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      viewerSubscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { payments: { orderBy: { createdAt: "desc" }, take: 10 } },
      },
    },
  });

  const sub = user?.viewerSubscriptions?.[0] ?? null;
  return NextResponse.json({ subscription: sub });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { plan, startTrial } = body as { plan?: string; startTrial?: boolean };

  const planType = plan === "STANDARD_3" ? "STANDARD_3" : plan === "FAMILY_5" ? "FAMILY_5" : "BASE_1";
  const deviceCount = planType === "BASE_1" ? 1 : planType === "STANDARD_3" ? 3 : 5;

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await prisma.viewerSubscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (existing && (existing.status === "TRIAL_ACTIVE" || existing.status === "ACTIVE")) {
    return NextResponse.json({ subscription: existing, message: "Already have an active subscription" });
  }

  const trialEndsAt = startTrial ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : null;
  const currentPeriodEnd = startTrial ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const status = startTrial ? "TRIAL_ACTIVE" : "ACTIVE";

  const subscription = await prisma.viewerSubscription.create({
    data: {
      userId: user.id,
      plan: planType,
      status,
      trialEndsAt,
      currentPeriodEnd,
      deviceCount,
    },
    include: { payments: true },
  });

  if (!startTrial) {
    await prisma.subscriptionPayment.create({
      data: {
        viewerSubscriptionId: subscription.id,
        amount: planType === "BASE_1" ? 39 : planType === "STANDARD_3" ? 79 : 99,
        currency: "ZAR",
        status: "COMPLETED",
        paidAt: new Date(),
      },
    });
  }

  return NextResponse.json({ subscription });
}
