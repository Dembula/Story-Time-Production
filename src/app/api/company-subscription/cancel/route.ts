import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cancelCompanySubscription,
  resumeCompanySubscription,
} from "@/lib/payments/company-subscription-billing";

const COMPANY_ROLES = ["CREW_TEAM", "CASTING_AGENCY", "LOCATION_OWNER", "EQUIPMENT_COMPANY", "CATERING_COMPANY"] as const;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user?.id || !role || !COMPANY_ROLES.includes(role as (typeof COMPANY_ROLES)[number])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { action?: "cancel" | "resume"; cancelAtPeriodEnd?: boolean }
    | null;

  if (body?.action === "resume") {
    const result = await resumeCompanySubscription(session.user.id, role);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true, subscription: result.subscription });
  }

  const result = await cancelCompanySubscription({
    userId: session.user.id,
    companyType: role,
    cancelAtPeriodEnd: body?.cancelAtPeriodEnd !== false,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({
    ok: true,
    subscription: result.subscription,
    immediate: result.immediate ?? false,
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user?.id || !role || !COMPANY_ROLES.includes(role as (typeof COMPANY_ROLES)[number])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const subscription = await prisma.companySubscription.findFirst({
    where: { userId: session.user.id, companyType: role },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      plan: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
      renewalAttemptCount: true,
      lastPaymentError: true,
    },
  });

  return NextResponse.json({ subscription });
}
