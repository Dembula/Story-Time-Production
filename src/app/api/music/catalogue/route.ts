import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tracks = await prisma.musicTrack.findMany({
    where: { published: true },
    select: {
      id: true,
      title: true,
      artistName: true,
      audioUrl: true,
      coverUrl: true,
      genre: true,
      mood: true,
      bpm: true,
      key: true,
      duration: true,
      description: true,
      tags: true,
      language: true,
      licenseType: true,
      isrc: true,
      createdAt: true,
      creator: { select: { id: true, name: true } },
      _count: { select: { syncDeals: true, syncRequests: true, musicSelections: true } },
      syncDeals: {
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          status: true,
          content: { select: { id: true, title: true, type: true } },
        },
      },
      musicSelections: {
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          usage: true,
          project: { select: { id: true, title: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tracks);
}
