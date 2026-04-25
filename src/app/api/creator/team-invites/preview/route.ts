import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public preview for join link (no auth). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const invite = await prisma.creatorStudioTeamInvite.findUnique({
    where: { token },
    include: { company: { select: { displayName: true } } },
  });
  if (!invite) {
    return NextResponse.json({ valid: false, error: "Invite not found." }, { status: 404 });
  }

  const expired = invite.expiresAt.getTime() < Date.now();
  return NextResponse.json({
    valid: invite.status === "PENDING" && !expired,
    status: invite.status,
    expired,
    companyName: invite.company.displayName,
    expiresAt: invite.expiresAt.toISOString(),
  });
}
