import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const invite = await prisma.festivalTeamInvite.findUnique({
    where: { token },
    include: { festival: { select: { id: true, name: true, logoUrl: true } } },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  return NextResponse.json({
    status: invite.status,
    role: invite.role,
    emailNorm: invite.emailNorm,
    expiresAt: invite.expiresAt,
    festival: invite.festival,
    expired: invite.expiresAt.getTime() <= Date.now(),
  });
}
