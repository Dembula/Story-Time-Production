import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Music creator scoring placements — tracks selected on Story Time productions. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId || role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [selections, syncDeals, memberships] = await Promise.all([
    prisma.musicSelection.findMany({
      where: { track: { creatorId: userId } },
      orderBy: { createdAt: "desc" },
      include: {
        track: { select: { id: true, title: true, coverUrl: true } },
        project: {
          select: {
            id: true,
            title: true,
            status: true,
            phase: true,
            type: true,
            genre: true,
          },
        },
      },
    }),
    prisma.syncDeal.findMany({
      where: { musicTrack: { creatorId: userId } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        musicTrack: { select: { id: true, title: true } },
        content: { select: { id: true, title: true, type: true } },
      },
    }),
    prisma.originalMember.findMany({
      where: { userId, status: "ACTIVE", department: "MUSIC" },
      include: {
        project: {
          select: { id: true, title: true, status: true, phase: true, type: true },
        },
      },
    }),
  ]);

  return NextResponse.json({ selections, syncDeals, memberships });
}
