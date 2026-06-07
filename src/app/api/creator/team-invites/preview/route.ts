import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPrismaMissingTable } from "@/lib/prisma-missing-table";

/** Public preview for join link (no auth). */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  try {
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
      emailNorm: invite.emailNorm,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (e) {
    if (isPrismaMissingTable(e, "CreatorStudioTeamInvite")) {
      return NextResponse.json(
        { valid: false, error: "Team invites are not available yet. Ask the studio owner to contact support." },
        { status: 503 },
      );
    }
    console.error("[team-invites/preview GET]", e);
    return NextResponse.json({ valid: false, error: "Could not load invite." }, { status: 500 });
  }
}
