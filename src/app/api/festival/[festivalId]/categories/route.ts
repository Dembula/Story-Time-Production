import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageFestival, requireFestivalAccess, requireFestivalSession } from "@/lib/festival/access";

type Ctx = { params: Promise<{ festivalId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { festivalId } = await ctx.params;
  const access = await requireFestivalAccess(festivalId, auth.userId, auth.role === "ADMIN");
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const categories = await prisma.festivalCategory.findMany({
    where: { festivalId },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { festivalId } = await ctx.params;
  const access = await requireFestivalAccess(festivalId, auth.userId, auth.role === "ADMIN");
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageFestival(access.membershipRole, auth.role === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Category name required." }, { status: 400 });

  const maxSort = await prisma.festivalCategory.aggregate({
    where: { festivalId },
    _max: { sortOrder: true },
  });

  const category = await prisma.festivalCategory.create({
    data: {
      festivalId,
      name,
      description: typeof body.description === "string" ? body.description.trim() : null,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      earlybirdFeeZar: Math.max(0, Number(body.earlybirdFeeZar) || 0),
      regularFeeZar: Math.max(0, Number(body.regularFeeZar) || 0),
      lateFeeZar: Math.max(0, Number(body.lateFeeZar) || 0),
    },
  });
  return NextResponse.json({ category }, { status: 201 });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { festivalId } = await ctx.params;
  const access = await requireFestivalAccess(festivalId, auth.userId, auth.role === "ADMIN");
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageFestival(access.membershipRole, auth.role === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Category id required." }, { status: 400 });

  const existing = await prisma.festivalCategory.findFirst({ where: { id, festivalId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const category = await prisma.festivalCategory.update({
    where: { id },
    data: {
      name: typeof body.name === "string" ? body.name.trim() : undefined,
      description: typeof body.description === "string" ? body.description.trim() : undefined,
      earlybirdFeeZar:
        body.earlybirdFeeZar != null ? Math.max(0, Number(body.earlybirdFeeZar) || 0) : undefined,
      regularFeeZar:
        body.regularFeeZar != null ? Math.max(0, Number(body.regularFeeZar) || 0) : undefined,
      lateFeeZar: body.lateFeeZar != null ? Math.max(0, Number(body.lateFeeZar) || 0) : undefined,
    },
  });
  return NextResponse.json({ category });
}
