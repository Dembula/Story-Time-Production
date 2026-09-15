import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { packBrowseContentList } from "@/lib/browse-media-pack";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as string | null;
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");
  const search = searchParams.get("search");
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));

  const where: Record<string, unknown> = { published: true };

  if (type) where.type = type;
  if (category) where.category = { contains: category, mode: "insensitive" };
  if (featured === "true") where.featured = true;
  if (search)
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];

  const content = await prisma.content.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      category: true,
      posterUrl: true,
      backdropUrl: true,
      trailerUrl: true,
      videoUrl: true,
      duration: true,
      featured: true,
      createdAt: true,
      creator: { select: { id: true, name: true, image: true } },
      _count: { select: { ratings: true } },
    },
    orderBy: featured === "true" ? { createdAt: "desc" } : { title: "asc" },
    take: limit,
  });

  const packed = await packBrowseContentList(content);
  // Never ship raw storage video URLs in catalogue feeds — play goes through playback-bundle.
  const items = packed.map(({ videoUrl: _v, trailerUrl: _t, ...row }) => ({
    ...row,
    trailerUrl: null as string | null,
  }));

  return NextResponse.json(items, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
}
