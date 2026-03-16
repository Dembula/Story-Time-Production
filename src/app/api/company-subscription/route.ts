import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { paymentGateway } from "@/lib/payments";

const COMPANY_ROLES = ["CREW_TEAM", "CASTING_AGENCY", "LOCATION_OWNER", "EQUIPMENT_COMPANY", "CATERING_COMPANY"] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (!role || !COMPANY_ROLES.includes(role as any)) return NextResponse.json({ subscription: null });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { companySubscriptions: { where: { companyType: role }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const sub = user?.companySubscriptions?.[0] ?? null;
  return NextResponse.json({ subscription: sub });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (!role || !COMPANY_ROLES.includes(role as any)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await prisma.companySubscription.findFirst({
    where: { userId: user.id, companyType: role, status: "ACTIVE" },
  });
  if (existing) return NextResponse.json({ subscription: existing });

  const body = await req.json();
  const plan = body.plan === "PROMOTED_R49" ? "PROMOTED_R49" : "STANDARD_R29";
  const amount = plan === "PROMOTED_R49" ? 49 : 29;

  const platform = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!platform) return NextResponse.json({ error: "Platform not configured" }, { status: 500 });

  const intent = await paymentGateway.createPaymentIntent({
    amount,
    currency: "ZAR",
    metadata: { type: "COMPANY_SUBSCRIPTION", userId: user.id, companyType: role, plan },
  });
  const result = await paymentGateway.confirmPayment(intent.id);
  if (!result.success) return NextResponse.json({ error: result.error || "Payment failed" }, { status: 400 });

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscription = await prisma.companySubscription.create({
    data: {
      userId: user.id,
      companyType: role,
      plan,
      status: "ACTIVE",
      currentPeriodEnd: periodEnd,
      externalPaymentId: intent.id,
    },
  });

  return NextResponse.json({ subscription });
}
