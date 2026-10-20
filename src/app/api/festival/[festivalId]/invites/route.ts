import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageFestival, requireFestivalAccess, requireFestivalSession } from "@/lib/festival/access";
import { createFestivalTeamInvite } from "@/lib/festival/invites";
import { buildAppUrl } from "@/lib/app-url";

type Ctx = { params: Promise<{ festivalId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const auth = await requireFestivalSession();
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { festivalId } = await ctx.params;
  const access = await requireFestivalAccess(festivalId, auth.userId, auth.role === "ADMIN");
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageFestival(access.membershipRole, auth.role === "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [invites, members] = await Promise.all([
    prisma.festivalTeamInvite.findMany({
      where: { festivalId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.festivalMembership.findMany({
      where: { festivalId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return NextResponse.json({ invites, members });
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
  const result = await createFestivalTeamInvite({
    festivalId,
    invitedByUserId: auth.userId,
    email: typeof body.email === "string" ? body.email : "",
    role: typeof body.role === "string" ? body.role : "STAGE1_REVIEWER",
    personalMessage: typeof body.personalMessage === "string" ? body.personalMessage : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({
    invite: result.invite,
    joinUrl: buildAppUrl(`/festival/join/${result.invite.token}`),
  }, { status: 201 });
}
