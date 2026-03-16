import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== "MUSIC_CREATOR" && role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = session.user.id;

  const tracks = await prisma.musicTrack.findMany({
    where: { creatorId: userId },
    include: {
      syncDeals: { include: { content: { select: { title: true, type: true } } } },
      syncRequests: {
        include: {
          requester: { select: { id: true, name: true, email: true } },
          _count: { select: { messages: true } },
        },
      },
    },
  });

  const totalTracks = tracks.length;
  const totalSyncEarnings = tracks.reduce((s, t) => s + t.syncDeals.reduce((ss, d) => ss + d.amount, 0), 0);
  const totalPlacements = tracks.reduce((s, t) => s + t.syncDeals.length, 0);
  const paidDeals = tracks.reduce((s, t) => s + t.syncDeals.filter((d) => d.status === "PAID").length, 0);
  const pendingRequests = tracks.reduce((s, t) => s + t.syncRequests.filter((r) => r.status === "PENDING").length, 0);
  const approvedRequests = tracks.reduce((s, t) => s + t.syncRequests.filter((r) => r.status === "APPROVED").length, 0);
  const totalRequests = tracks.reduce((s, t) => s + t.syncRequests.length, 0);
  const genres = [...new Set(tracks.map((t) => t.genre).filter(Boolean))];

  const earningsByTrack = tracks.map((t) => ({
    id: t.id,
    title: t.title,
    genre: t.genre,
    earnings: t.syncDeals.reduce((s, d) => s + d.amount, 0),
    placements: t.syncDeals.length,
    requests: t.syncRequests.length,
    pendingRequests: t.syncRequests.filter((r) => r.status === "PENDING").length,
  }));

  const earningsByFilm = tracks.flatMap((t) =>
    t.syncDeals.map((d) => ({ track: t.title, film: d.content.title, filmType: d.content.type, amount: d.amount, status: d.status }))
  );

  const potentialRevenue = tracks.reduce((s, t) =>
    s + t.syncRequests.filter((r) => r.status === "PENDING").reduce((ss, r) => ss + (r.budget || 0), 0), 0
  );

  return NextResponse.json({
    totalTracks, totalSyncEarnings, totalPlacements, paidDeals,
    pendingRequests, approvedRequests, totalRequests,
    genres, earningsByTrack, earningsByFilm, potentialRevenue,
  });
}
