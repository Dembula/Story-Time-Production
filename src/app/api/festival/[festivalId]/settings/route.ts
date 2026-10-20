import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageFestival, requireFestivalAccess, requireFestivalSession } from "@/lib/festival/access";
import { FESTIVAL_STATUS } from "@/lib/festival/constants";
import { releaseUniverseHoldsForFestival } from "@/lib/festival/universe-hold";

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
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "publish") {
    if (access.festival.status === FESTIVAL_STATUS.ENDED) {
      return NextResponse.json({ error: "Cannot republish an ended festival." }, { status: 400 });
    }
    const festival = await prisma.festival.update({
      where: { id: festivalId },
      data: { status: FESTIVAL_STATUS.LIVE, acceptingSubmissions: true },
    });
    return NextResponse.json({ festival });
  }

  if (action === "set_accepting_submissions") {
    if (access.festival.status === FESTIVAL_STATUS.ENDED) {
      return NextResponse.json({ error: "Festival has ended." }, { status: 400 });
    }
    const accepting = Boolean(body.acceptingSubmissions);
    const festival = await prisma.festival.update({
      where: { id: festivalId },
      data: {
        acceptingSubmissions: accepting,
        status: accepting ? FESTIVAL_STATUS.LIVE : FESTIVAL_STATUS.SUBMISSIONS_CLOSED,
      },
    });
    return NextResponse.json({ festival });
  }

  if (action === "end_festival") {
    if (access.festival.status === FESTIVAL_STATUS.ENDED) {
      return NextResponse.json({ error: "Already ended." }, { status: 400 });
    }
    const festival = await prisma.festival.update({
      where: { id: festivalId },
      data: {
        status: FESTIVAL_STATUS.ENDED,
        acceptingSubmissions: false,
        endedAt: new Date(),
      },
    });
    const released = await releaseUniverseHoldsForFestival(festivalId);
    return NextResponse.json({ festival, universeHoldsReleased: released.count });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
