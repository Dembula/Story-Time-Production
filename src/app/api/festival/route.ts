import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  listAccessibleFestivals,
  requireFestivalSession,
} from "@/lib/festival/access";
import { FESTIVAL_MEMBER_ROLE, FESTIVAL_STATUS, slugifyFestivalName } from "@/lib/festival/constants";

export async function GET() {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const festivals = await listAccessibleFestivals(auth.userId);
  return NextResponse.json({ festivals });
}

export async function POST(req: NextRequest) {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Festival name is required." }, { status: 400 });

  let slug = slugifyFestivalName(name);
  const existing = await prisma.festival.findUnique({ where: { slug }, select: { id: true } });
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const festival = await prisma.$transaction(async (tx) => {
    const created = await tx.festival.create({
      data: {
        ownerUserId: auth.userId,
        slug,
        name,
        tagline: typeof body.tagline === "string" ? body.tagline.trim() : null,
        about: typeof body.about === "string" ? body.about.trim() : null,
        status: FESTIVAL_STATUS.DRAFT,
        acceptingSubmissions: true,
        yearsRunning: Number.isFinite(Number(body.yearsRunning)) ? Math.max(1, Number(body.yearsRunning)) : 1,
      },
    });
    await tx.festivalMembership.create({
      data: {
        festivalId: created.id,
        userId: auth.userId,
        role: FESTIVAL_MEMBER_ROLE.OWNER,
      },
    });
    return created;
  });

  return NextResponse.json({ festival }, { status: 201 });
}
