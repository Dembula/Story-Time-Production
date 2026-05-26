import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";

export async function GET(req: NextRequest) {
  try {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  const exclude = req.nextUrl.searchParams.get("exclude")?.trim();

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const crewMatches = await prisma.crewMember.findMany({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exclude ? { contentId: { not: exclude } } : {}),
      content: { published: true },
    },
    select: {
      name: true,
      role: true,
      bio: true,
      content: {
        select: {
          id: true,
          title: true,
          posterUrl: true,
          backdropUrl: true,
          videoUrl: true,
          trailerUrl: true,
          type: true,
          year: true,
          category: true,
        },
      },
    },
    take: 12,
  });

  if (crewMatches.length === 0) {
    return NextResponse.json({ name, role: null, bio: null, titles: [] });
  }

  const first = crewMatches[0];
  const seen = new Set<string>();
  const titles = [];
  for (const row of crewMatches) {
    if (seen.has(row.content.id)) continue;
    seen.add(row.content.id);
    titles.push({
      id: row.content.id,
      title: row.content.title,
      type: row.content.type,
      year: row.content.year,
      category: row.content.category,
      posterUrl: getDisplayPosterUrl(row.content),
    });
  }

  return NextResponse.json({
    name: first.name,
    role: first.role,
    bio: first.bio,
    titles: titles.slice(0, 8),
  });
  } catch (err) {
    console.error("Browse people API error:", err);
    return NextResponse.json({ name: "", role: null, bio: null, titles: [] });
  }
}
