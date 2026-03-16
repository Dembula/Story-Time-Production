import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const content = await prisma.content.findUnique({
    where: { id, published: true },
    include: {
      creator: { select: { id: true, name: true, image: true } },
      btsVideos: { orderBy: { sortOrder: "asc" } },
      _count: { select: { ratings: true, comments: true } },
    },
  });

  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const avgRating = await prisma.rating.aggregate({
    where: { contentId: id },
    _avg: { score: true },
    _count: true,
  });

  return NextResponse.json({
    ...content,
    ratingStats: {
      average: avgRating._avg.score ?? 0,
      count: avgRating._count,
    },
  });
}
