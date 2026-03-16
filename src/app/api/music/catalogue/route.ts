import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tracks = await prisma.musicTrack.findMany({
    where: { published: true },
    select: {
      id: true, title: true, artistName: true, audioUrl: true, coverUrl: true,
      genre: true, mood: true, bpm: true, key: true, duration: true,
      description: true, tags: true, language: true, licenseType: true,
      createdAt: true,
      creator: { select: { id: true, name: true, email: true } },
      _count: { select: { syncDeals: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tracks);
}
