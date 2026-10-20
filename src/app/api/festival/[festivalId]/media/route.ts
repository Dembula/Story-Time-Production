import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageFestival, requireFestivalAccess, requireFestivalSession } from "@/lib/festival/access";

type Ctx = { params: Promise<{ festivalId: string }> };

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
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "Media URL required." }, { status: 400 });
  const kind = body.kind === "VIDEO" ? "VIDEO" : "IMAGE";

  const maxSort = await prisma.festivalMediaAsset.aggregate({
    where: { festivalId },
    _max: { sortOrder: true },
  });

  const asset = await prisma.festivalMediaAsset.create({
    data: {
      festivalId,
      url,
      kind,
      caption: typeof body.caption === "string" ? body.caption.trim() : null,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ asset }, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { festivalId } = await ctx.params;
  const access = await requireFestivalAccess(festivalId, auth.userId, auth.role === "ADMIN");
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageFestival(access.membershipRole, auth.role === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.festivalMediaAsset.deleteMany({ where: { id, festivalId } });
  return NextResponse.json({ ok: true });
}
