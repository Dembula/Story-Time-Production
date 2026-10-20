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

  const counts = await prisma.festivalSubmission.groupBy({
    by: ["paymentStatus", "reviewStage", "selectionStatus"],
    where: { festivalId, paymentStatus: "PAID" },
    _count: true,
  });

  return NextResponse.json({
    festival: access.festival,
    membershipRole: access.membershipRole,
    canManage: canManageFestival(access.membershipRole, auth.role === "ADMIN"),
    counts,
  });
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
  if (access.festival.status === "ENDED") {
    return NextResponse.json({ error: "Festival has ended for this year." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const str = (k: string) => (typeof body[k] === "string" ? body[k].trim() || null : undefined);
  const date = (k: string) => {
    if (body[k] === null) return null;
    if (typeof body[k] !== "string" || !body[k]) return undefined;
    const d = new Date(body[k]);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  const festival = await prisma.festival.update({
    where: { id: festivalId },
    data: {
      name: str("name") ?? undefined,
      tagline: str("tagline"),
      about: str("about"),
      awardsText: str("awardsText"),
      rulesText: str("rulesText"),
      organizers: str("organizers"),
      logoUrl: str("logoUrl"),
      headerImageUrl: str("headerImageUrl"),
      contactEmail: str("contactEmail"),
      contactPhone: str("contactPhone"),
      websiteUrl: str("websiteUrl"),
      facebookUrl: str("facebookUrl"),
      twitterUrl: str("twitterUrl"),
      instagramUrl: str("instagramUrl"),
      yearsRunning:
        body.yearsRunning != null && Number.isFinite(Number(body.yearsRunning))
          ? Math.max(1, Number(body.yearsRunning))
          : undefined,
      venues: body.venues !== undefined ? body.venues : undefined,
      openingAt: date("openingAt"),
      earlybirdAt: date("earlybirdAt"),
      regularAt: date("regularAt"),
      lateAt: date("lateAt"),
      notificationAt: date("notificationAt"),
      eventStartsAt: date("eventStartsAt"),
      eventEndsAt: date("eventEndsAt"),
    },
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      mediaAssets: { orderBy: { sortOrder: "asc" } },
      flagDefs: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json({ festival });
}
