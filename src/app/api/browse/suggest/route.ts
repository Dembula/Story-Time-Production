import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";

/** Fast title-prefix suggestions for search autocomplete. */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const type = req.nextUrl.searchParams.get("type")?.trim();
    const limit = Math.min(10, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 8)));

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
    const baseWhere = { published: true, ...ageFilter, ...(type ? { type } : {}) };

    const [prefixMatches, containsMatches] = await Promise.all([
      prisma.content.findMany({
        where: {
          ...baseWhere,
          title: { startsWith: q, mode: "insensitive" },
        },
        include: { creator: { select: { name: true } } },
        orderBy: { title: "asc" },
        take: limit,
      }),
      prisma.content.findMany({
        where: {
          ...baseWhere,
          NOT: { title: { startsWith: q, mode: "insensitive" } },
          title: { contains: q, mode: "insensitive" },
        },
        include: { creator: { select: { name: true } } },
        orderBy: { title: "asc" },
        take: limit,
      }),
    ]);

    const seen = new Set<string>();
    const merged = [...prefixMatches, ...containsMatches].filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).slice(0, limit);

    return NextResponse.json({
      results: merged.map((c) => ({
        id: c.id,
        title: c.title,
        type: c.type,
        category: c.category,
        posterUrl: getDisplayPosterUrl(c),
        creatorName: c.creator?.name ?? null,
      })),
    });
  } catch (err) {
    console.error("Browse suggest API error:", err);
    return NextResponse.json({ results: [] });
  }
}
