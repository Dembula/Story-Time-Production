import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyPlanConfig, normalizeCompanyPlan } from "@/lib/pricing";

const COMPANY_ROLES = ["CREW_TEAM", "CASTING_AGENCY", "LOCATION_OWNER", "EQUIPMENT_COMPANY", "CATERING_COMPANY"] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (!role || !COMPANY_ROLES.includes(role as any)) return NextResponse.json({ subscription: null });
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      companySubscriptions: {
        where: {
          companyType: role,
          status: "ACTIVE",
          currentPeriodEnd: { gt: now },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
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
  const now = new Date();

  const existing = await prisma.companySubscription.findFirst({
    where: {
      userId: user.id,
      companyType: role,
      status: "ACTIVE",
      currentPeriodEnd: { gt: now },
    },
  });
  if (existing) return NextResponse.json({ subscription: existing });

  const body = await req.json();
  const plan = normalizeCompanyPlan(body.plan);
  const amount = getCompanyPlanConfig(plan).price;

  const subscription = await prisma.companySubscription.create({
    data: {
      userId: user.id,
      companyType: role,
      plan,
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      billingEmail: user.email,
      lastPaymentStatus: "DISABLED",
      lastPaymentAt: new Date(),
    },
  });

  return NextResponse.json({
    requiresPayment: false,
    subscription,
  });
}
