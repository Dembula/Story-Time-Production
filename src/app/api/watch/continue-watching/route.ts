import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CONTINUE_WATCHING_MAX_FRACTION,
  CONTINUE_WATCHING_MIN_SECONDS,
  getActiveViewerProfileId,
} from "@/lib/watch-progress";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { getDisplayPosterUrl } from "@/lib/content-media-urls";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json([]);
  }

  const profileId = await getActiveViewerProfileId(session.user.id);
  if (!profileId) return NextResponse.json([]);

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
    take: 24,
    include: {
      content: {
        select: {
          id: true,
          title: true,
          posterUrl: true,
          backdropUrl: true,
          category: true,
          type: true,
          duration: true,
          trailerUrl: true,
          videoUrl: true,
        },
      },
    },
  });

  const items = rows
    .filter((row) => {
      const dur = row.durationSeconds ?? row.content.duration ?? null;
      if (!dur || dur <= 0) return true;
      return row.positionSeconds / dur < CONTINUE_WATCHING_MAX_FRACTION;
    })
    .map((row) => ({
      ...row.content,
      posterUrl: getDisplayPosterUrl(row.content) ?? row.content.posterUrl,
      positionSeconds: row.positionSeconds,
      durationSeconds: row.durationSeconds ?? row.content.duration,
      progressPercent:
        row.durationSeconds && row.durationSeconds > 0
          ? Math.round((row.positionSeconds / row.durationSeconds) * 100)
          : row.content.duration && row.content.duration > 0
            ? Math.round((row.positionSeconds / row.content.duration) * 100)
            : 0,
      _count: { ratings: 0 },
    }));

  return NextResponse.json(items.slice(0, 12));
}
