import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeInviteEmail } from "@/lib/creator-team-invites";

/** Pending studio team invites for the signed-in user's email. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const email = session?.user?.email?.trim().toLowerCase();
  if (!userId || !email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const emailNorm = normalizeInviteEmail(email);
  const now = new Date();

  const invites = await prisma.creatorStudioTeamInvite.findMany({
    where: {
      emailNorm,
      status: "PENDING",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { id: true, displayName: true, seatCap: true } },
      invitedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    invites: invites.map((i: (typeof invites)[number]) => ({
      id: i.id,
      token: i.token,
      companyId: i.companyId,
      companyName: i.company.displayName,
      seatCap: i.company.seatCap,
      suiteAccess: i.suiteAccess,
      personalMessage: i.personalMessage,
      invitedByName: i.invitedBy.name ?? i.invitedBy.email ?? "Studio admin",
      expiresAt: i.expiresAt.toISOString(),
    })),
  });
}
