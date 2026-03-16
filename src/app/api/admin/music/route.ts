import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const artists = await prisma.user.findMany({
    where: { role: "MUSIC_CREATOR" },
    select: {
      id: true, name: true, email: true,
      bio: true, socialLinks: true, education: true, goals: true, previousWork: true, isAfdaStudent: true,
      musicTracks: {
        select: {
          id: true, title: true, artistName: true, genre: true,
          syncDeals: { select: { amount: true, status: true, content: { select: { title: true, type: true } } } },
        },
      },
    },
  });

  const enriched = artists.map((a) => {
    const totalTracks = a.musicTracks.length;
    const totalEarnings = a.musicTracks.reduce((s, t) => s + t.syncDeals.reduce((s2, d) => s2 + d.amount, 0), 0);
    const totalPlacements = a.musicTracks.reduce((s, t) => s + t.syncDeals.length, 0);
    const genres = [...new Set(a.musicTracks.map((t) => t.genre).filter(Boolean))] as string[];
    return { ...a, totalTracks, totalEarnings, totalPlacements, genres };
  });

  return NextResponse.json(enriched.sort((a, b) => b.totalEarnings - a.totalEarnings));
}
