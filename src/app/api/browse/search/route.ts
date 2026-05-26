import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { rankSearchResults } from "@/lib/browse-search";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";

export async function GET(req: NextRequest) {
  try {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = req.nextUrl.searchParams.get("type")?.trim();
  const category = req.nextUrl.searchParams.get("category")?.trim();
  const limit = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 12)));

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  let profileAge: number | null = null;
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const cookieStore = await cookies();
    const profileId = cookieStore.get("st_viewer_profile")?.value;
    if (profileId) {
      const profile = await prisma.viewerProfile.findFirst({
        where: { id: profileId, userId: session.user.id },
        select: { age: true, dateOfBirth: true },
      });
      if (profile) profileAge = getViewerProfileAge(profile);
    }
  }

  const ageFilter = profileAge != null ? { minAge: { lte: profileAge } } : {};

  const items = await prisma.content.findMany({
    where: {
      published: true,
      ...ageFilter,
      ...(type ? { type } : {}),
      ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { tags: { contains: q, mode: "insensitive" } },
        { creator: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: {
      creator: { select: { name: true } },
      _count: { select: { ratings: true } },
    },
    take: 48,
  });

  const ranked = rankSearchResults(items, q).slice(0, limit);

  return NextResponse.json({
    results: ranked.map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
      category: c.category,
      year: c.year,
      posterUrl: getDisplayPosterUrl(c),
      creatorName: c.creator?.name ?? null,
      ratingCount: c._count.ratings,
    })),
  });
  } catch (err) {
    console.error("Browse search API error:", err);
    return NextResponse.json({ results: [] });
  }
}
