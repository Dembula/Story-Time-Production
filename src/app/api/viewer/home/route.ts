import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { packBrowseContentList } from "@/lib/browse-media-pack";
import {
  CONTINUE_WATCHING_MAX_FRACTION,
  CONTINUE_WATCHING_MIN_SECONDS,
  getActiveViewerProfileId,
} from "@/lib/watch-progress";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { TV_CORS_HEADERS } from "@/lib/tv-auth-edge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lean home feed for Story Time Universe iOS/Android.
 * Returns only card fields with packed poster/backdrop URLs — no video URLs.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: TV_CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const limit = Math.min(24, Math.max(6, Number(req.nextUrl.searchParams.get("limit") || 16) || 16));

  const [featuredRaw, newestRaw] = await Promise.all([
    prisma.content.findMany({
      where: { published: true, featured: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        type: true,
        category: true,
        posterUrl: true,
        backdropUrl: true,
        videoUrl: true,
        trailerUrl: true,
        duration: true,
      },
    }),
    prisma.content.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        type: true,
        category: true,
        posterUrl: true,
        backdropUrl: true,
        videoUrl: true,
        trailerUrl: true,
        duration: true,
      },
    }),
  ]);

  let continueWatching: Array<{
    id: string;
    title: string;
    type: string | null;
    category: string | null;
    posterUrl: string | null;
    backdropUrl: string | null;
    duration: number | null;
    positionSeconds: number;
    durationSeconds: number | null;
    progressPercent: number;
  }> = [];

  if (session?.user?.id) {
    const profileId = await getActiveViewerProfileId(session.user.id);
    if (profileId) {
      const profile = await prisma.viewerProfile.findFirst({
        where: { id: profileId, userId: session.user.id },
        select: { age: true, dateOfBirth: true },
      });
      const profileAge = profile ? getViewerProfileAge(profile) : null;
      const ageFilter = profileAge != null ? { minAge: { lte: profileAge } } : {};
      const rows = await prisma.watchProgress.findMany({
        where: {
          viewerProfileId: profileId,
          positionSeconds: { gte: CONTINUE_WATCHING_MIN_SECONDS },
          content: { published: true, videoUrl: { not: null }, ...ageFilter },
        },
        orderBy: { updatedAt: "desc" },
        take: 16,
        include: {
          content: {
            select: {
              id: true,
              title: true,
              type: true,
              category: true,
              posterUrl: true,
              backdropUrl: true,
              videoUrl: true,
              trailerUrl: true,
              duration: true,
            },
          },
        },
      });
      const filtered = rows
        .filter((row) => {
          const dur = row.durationSeconds ?? row.content.duration ?? null;
          if (!dur || dur <= 0) return true;
          return row.positionSeconds / dur < CONTINUE_WATCHING_MAX_FRACTION;
        })
        .slice(0, 10);
      const packedRows = await packBrowseContentList(filtered.map((r) => r.content));
      continueWatching = filtered.map((row, i) => {
        const packed = packedRows[i] ?? row.content;
        const durationSeconds = row.durationSeconds ?? row.content.duration;
        return {
          id: packed.id,
          title: packed.title,
          type: packed.type,
          category: packed.category,
          posterUrl: packed.posterUrl,
          backdropUrl: packed.backdropUrl,
          duration: packed.duration,
          positionSeconds: row.positionSeconds,
          durationSeconds,
          progressPercent:
            durationSeconds && durationSeconds > 0
              ? Math.round((row.positionSeconds / durationSeconds) * 100)
              : 0,
        };
      });
    }
  }

  const [featured, newest] = await Promise.all([
    packBrowseContentList(featuredRaw),
    packBrowseContentList(newestRaw),
  ]);

  const slim = <T extends { videoUrl?: string | null; trailerUrl?: string | null }>(rows: T[]) =>
    rows.map(({ videoUrl: _v, trailerUrl: _t, ...rest }) => rest);

  return NextResponse.json(
    {
      featured: slim(featured),
      newest: slim(newest),
      continueWatching,
    },
    {
      headers: {
        ...TV_CORS_HEADERS,
        "Cache-Control": session?.user?.id
          ? "private, max-age=20, stale-while-revalidate=60"
          : "public, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
