import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPayFastConfigured } from "@/lib/payments/config";
import { getPayFastTokenForUser } from "@/lib/payments/payfast-saved-card";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

/** Lightweight card-on-file status for any authenticated role. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPayFastConfigured()) {
    return NextResponse.json({
      configured: false,
      hasToken: false,
      label: null,
      lastFour: null,
      cardType: null,
    });
  }

  const token = await getPayFastTokenForUser(userId);
  if (!token) {
    return NextResponse.json({
      configured: true,
      hasToken: false,
      label: null,
      lastFour: null,
      cardType: null,
    });
  }

  const method =
    token.methodId
      ? await db.viewerPaymentMethod.findFirst({
          where: { id: token.methodId, userId },
          select: { label: true, lastFour: true, cardType: true },
        })
      : await db.viewerPaymentMethod.findFirst({
          where: {
            userId,
            reusable: true,
            OR: [{ authorizationCode: token.token }, { customerCode: token.token }],
          },
          select: { label: true, lastFour: true, cardType: true },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        });

  return NextResponse.json({
    configured: true,
    hasToken: true,
    label: method?.label ?? null,
    lastFour: method?.lastFour ?? null,
    cardType: method?.cardType ?? token.cardType ?? null,
  });
}
