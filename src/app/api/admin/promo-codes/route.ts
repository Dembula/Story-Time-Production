import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

const ALLOWED_KINDS = new Set(["DISCOUNT_PERCENT", "DISCOUNT_FIXED", "FREE_YEAR_SUBSCRIPTION"]);
const ALLOWED_TARGETS = new Set(["VIEWER_SUBSCRIPTION", "CREATOR_LICENSE", "ANY"]);

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const promoCodes = await prisma.promoCode.findMany({
    include: {
      _count: { select: { redemptions: true } },
      redemptions: {
        orderBy: { redeemedAt: "desc" },
        take: 25,
        select: {
          id: true,
          context: true,
          referenceId: true,
          discountAmount: true,
          resultingPlan: true,
          redeemedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(promoCodes);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (role !== "ADMIN" || !adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    code?: string;
    description?: string;
    kind?: string;
    amount?: number;
    target?: string;
    maxRedemptions?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    active?: boolean;
  };
  const code = normalizeCode(body.code ?? "");
  if (!code) return NextResponse.json({ error: "Code is required." }, { status: 400 });
  if (!body.kind) return NextResponse.json({ error: "Promo kind is required." }, { status: 400 });
  if (!body.target) return NextResponse.json({ error: "Promo target is required." }, { status: 400 });
  if (!ALLOWED_KINDS.has(body.kind)) {
    return NextResponse.json({ error: "Invalid promo kind." }, { status: 400 });
  }
  if (!ALLOWED_TARGETS.has(body.target)) {
    return NextResponse.json({ error: "Invalid promo target." }, { status: 400 });
  }
  const amount =
    body.kind === "FREE_YEAR_SUBSCRIPTION"
      ? null
      : typeof body.amount === "number" && Number.isFinite(body.amount)
        ? body.amount
        : null;
  if (body.kind !== "FREE_YEAR_SUBSCRIPTION" && amount == null) {
    return NextResponse.json({ error: "Amount is required for discount promo kinds." }, { status: 400 });
  }
  if (body.kind === "DISCOUNT_PERCENT" && (amount == null || amount < 0 || amount > 100)) {
    return NextResponse.json({ error: "Percent discount must be between 0 and 100." }, { status: 400 });
  }
  if (body.kind === "DISCOUNT_FIXED" && (amount == null || amount < 0)) {
    return NextResponse.json({ error: "Fixed discount must be greater than or equal to 0." }, { status: 400 });
  }
  if (body.startsAt && body.expiresAt) {
    const startsAt = new Date(body.startsAt);
    const expiresAt = new Date(body.expiresAt);
    if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(expiresAt.getTime()) && startsAt >= expiresAt) {
      return NextResponse.json({ error: "Expiry must be later than start date." }, { status: 400 });
    }
  }

  const created = await prisma.promoCode.create({
    data: {
      code,
      description: body.description?.trim() || null,
      kind: body.kind,
      amount,
      target: body.target,
      maxRedemptions:
        typeof body.maxRedemptions === "number" && Number.isFinite(body.maxRedemptions)
          ? Math.max(1, Math.floor(body.maxRedemptions))
          : null,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      active: body.active ?? true,
      createdByAdminId: adminId,
    },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    id?: string;
    active?: boolean;
    maxRedemptions?: number | null;
    expiresAt?: string | null;
  };
  if (!body.id) return NextResponse.json({ error: "Promo code id is required." }, { status: 400 });

  const updated = await prisma.promoCode.update({
    where: { id: body.id },
    data: {
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      ...(typeof body.maxRedemptions === "number" && Number.isFinite(body.maxRedemptions)
        ? { maxRedemptions: Math.max(1, Math.floor(body.maxRedemptions)) }
        : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
    },
  });
  return NextResponse.json(updated);
}
