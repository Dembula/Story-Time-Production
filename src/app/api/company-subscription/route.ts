import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanyPlanConfig, normalizeCompanyPlan } from "@/lib/pricing";
import { initializeCheckout } from "@/lib/payments/billing";
import { buildPaymentReturnUrl } from "@/lib/payments/return-url";

const COMPANY_ROLES = ["CREW_TEAM", "CASTING_AGENCY", "LOCATION_OWNER", "EQUIPMENT_COMPANY", "CATERING_COMPANY"] as const;

function companyDashboardPathForRole(role: string) {
  switch (role) {
    case "CREW_TEAM":
      return "/crew-team/dashboard";
    case "CASTING_AGENCY":
      return "/casting-agency/dashboard";
    case "LOCATION_OWNER":
      return "/location-owner/dashboard";
    case "EQUIPMENT_COMPANY":
      return "/equipment-company/dashboard";
    case "CATERING_COMPANY":
      return "/catering-company/dashboard";
    default:
      return "/company/onboarding/subscription";
  }
}

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
  const redirectTo = companyDashboardPathForRole(role);

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

  const body = (await req.json().catch(() => null)) as { plan?: string } | null;
  if (!body) return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  const plan = normalizeCompanyPlan(body.plan);
  const amount = getCompanyPlanConfig(plan).price;

  const subscription = await prisma.companySubscription.create({
    data: {
      userId: user.id,
      companyType: role,
      plan,
      status: "PAST_DUE",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      billingEmail: user.email,
      lastPaymentStatus: "PENDING",
      lastPaymentAt: null,
    },
  });

  let checkoutUrl: string;
  try {
    const checkout = await initializeCheckout({
      userId: user.id,
      email: user.email,
      customerName: user.name,
      amount,
      purpose: "company_subscription",
      referenceType: "CompanySubscription",
      referenceId: subscription.id,
      returnUrl: buildPaymentReturnUrl(redirectTo, "company_subscription"),
      metadata: { plan, companyType: role },
    });
    checkoutUrl = checkout.checkout.checkoutUrl;
  } catch (error) {
    await prisma.companySubscription.update({
      where: { id: subscription.id },
      data: { lastPaymentStatus: "FAILED", status: "PAST_DUE" },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to initialize checkout." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    requiresPayment: true,
    checkoutUrl,
    redirectTo,
    subscription,
  });
}
