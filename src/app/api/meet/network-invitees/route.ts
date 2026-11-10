import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession } from "@/lib/meet/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creators you follow or are connected with — for Meet invite picker. */
export async function GET() {
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [following, connections] = await Promise.all([
    prisma.creatorFollow.findMany({
      where: { followerId: session.userId },
      include: {
        following: {
          select: {
            id: true,
            name: true,
            professionalName: true,
            email: true,
            image: true,
            networkHandle: true,
            headline: true,
          },
        },
      },
      take: 100,
    }),
    prisma.connectionRequest.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ fromId: session.userId }, { toId: session.userId }],
      },
      take: 100,
    }),
  ]);

  const connectedIds = new Set<string>();
  for (const c of connections) {
    connectedIds.add(c.fromId === session.userId ? c.toId : c.fromId);
  }

  const connectedUsers = connectedIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...connectedIds] } },
        select: {
          id: true,
          name: true,
          professionalName: true,
          email: true,
          image: true,
          networkHandle: true,
          headline: true,
        },
      })
    : [];

  const byId = new Map<string, (typeof connectedUsers)[number] & { relationship: string }>();
  for (const f of following) {
    byId.set(f.following.id, { ...f.following, relationship: "following" });
  }
  for (const u of connectedUsers) {
    const prev = byId.get(u.id);
    byId.set(u.id, {
      ...u,
      relationship: prev ? "following+connected" : "connected",
    });
  }

  return NextResponse.json({
    people: [...byId.values()].sort((a, b) =>
      (a.professionalName || a.name || "").localeCompare(b.professionalName || b.name || ""),
    ),
  });
}
