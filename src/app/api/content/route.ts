import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as string | null;
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");
  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "20");

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
    include: {
      creator: { select: { id: true, name: true, image: true } },
      _count: { select: { ratings: true } },
    },
    orderBy: featured === "true" ? { createdAt: "desc" } : { title: "asc" },
    take: limit,
  });

  return NextResponse.json(content);
}
