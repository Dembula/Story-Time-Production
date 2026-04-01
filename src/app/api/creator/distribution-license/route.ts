import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCreatorLicenseType } from "@/lib/pricing";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { creatorDistributionLicense: true },
  });
  const role = (session.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") return NextResponse.json({ license: null });

  return NextResponse.json({ license: user?.creatorDistributionLicense ?? null });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const role = (session.user as { role?: string })?.role;
  if (!user || (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.creatorDistributionLicense.findUnique({ where: { userId: user.id } });
  if (existing) return NextResponse.json({ license: existing });

  const body = await req.json();
  const { type } = body as { type?: string };
  const licenseType = normalizeCreatorLicenseType(type);

  if (licenseType === "YEARLY") {
    const license = await prisma.creatorDistributionLicense.create({
      data: {
        userId: user.id,
        type: licenseType,
        yearlyExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        externalPaymentId: null,
      },
    });
    return NextResponse.json({
      license,
      requiresPayment: false,
      redirectTo: role === "MUSIC_CREATOR" ? "/music-creator/dashboard" : "/creator/dashboard",
    });
  }

  const license = await prisma.creatorDistributionLicense.create({
    data: {
      userId: user.id,
      type: licenseType,
      yearlyExpiresAt: null,
      externalPaymentId: null,
    },
  });

  return NextResponse.json({ license });
}
