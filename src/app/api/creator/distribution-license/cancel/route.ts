import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cancelCreatorLicenseRenewal,
  resumeCreatorLicenseRenewal,
} from "@/lib/payments/creator-license-billing";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user?.id || (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { action?: "cancel" | "resume"; cancelAtPeriodEnd?: boolean }
    | null;

  if (body?.action === "resume") {
    const result = await resumeCreatorLicenseRenewal(session.user.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true, license: result.license });
  }

  const result = await cancelCreatorLicenseRenewal(session.user.id, body?.cancelAtPeriodEnd !== false);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({
    ok: true,
    license: result.license,
    immediate: result.immediate ?? false,
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user?.id || (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const license = await prisma.creatorDistributionLicense.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      type: true,
      status: true,
      autoRenew: true,
      cancelAtPeriodEnd: true,
      yearlyExpiresAt: true,
      renewalAttemptCount: true,
      lastPaymentError: true,
    },
  });

  return NextResponse.json({ license });
}
