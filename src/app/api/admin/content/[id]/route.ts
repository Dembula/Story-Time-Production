import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { packAdminContentMediaFields } from "@/lib/admin-content-media-pack";
import { buildAdminMediaChecklist } from "@/lib/admin/admin-media-checklist";
import { getStoryTimeOriginalBadge } from "@/lib/storytime-original";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const content = await prisma.content.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, email: true, isAfdaStudent: true } },
      linkedProject: {
        select: {
          id: true,
          title: true,
          pitches: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, title: true } },
        },
      },
      crewMembers: { select: { id: true, name: true, role: true }, take: 100 },
      btsVideos: {
        select: { id: true, title: true, videoUrl: true, thumbnail: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      },
      subtitles: {
        select: { id: true, language: true, label: true, vttUrl: true, isDefault: true },
      },
      seasons: {
        orderBy: { seasonNumber: "asc" },
        include: {
          episodes: {
            orderBy: { episodeNumber: "asc" },
            select: {
              id: true,
              episodeNumber: true,
              title: true,
              description: true,
              videoUrl: true,
              thumbnailUrl: true,
              duration: true,
            },
          },
        },
      },
      ratings: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          score: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          body: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            take: 20,
            select: {
              id: true,
              body: true,
              createdAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
      watchSessions: {
        orderBy: { startedAt: "desc" },
        take: 25,
        select: {
          id: true,
          startedAt: true,
          durationSeconds: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: {
        select: {
          watchSessions: true,
          ratings: true,
          comments: true,
          crewMembers: true,
          btsVideos: true,
          subtitles: true,
        },
      },
    },
  });

  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const packed = await packAdminContentMediaFields(content);
  const checklist = buildAdminMediaChecklist({
    type: content.type,
    videoUrl: packed.videoUrl,
    posterUrl: packed.posterUrl,
    backdropUrl: packed.backdropUrl,
    trailerUrl: packed.trailerUrl,
    scriptUrl: packed.scriptUrl,
    seasons: content.seasons,
  });

  const ratingScores = content.ratings.map((r) => r.score);
  const ratingAverage =
    ratingScores.length > 0
      ? Math.round((ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length) * 10) / 10
      : null;

  const latestPitch = content.linkedProject?.pitches[0] ?? null;
  const originalBadge = getStoryTimeOriginalBadge(latestPitch);

  return NextResponse.json({
    ...packed,
    seasons: content.seasons,
    crewMembers: content.crewMembers,
    btsVideos: content.btsVideos,
    subtitles: content.subtitles,
    ratings: content.ratings.map((r) => ({
      id: r.id,
      score: r.score,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
    })),
    ratingAverage,
    comments: content.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
      replies: c.replies.map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
        user: r.user,
      })),
    })),
    recentWatches: content.watchSessions.map((w) => ({
      id: w.id,
      startedAt: w.startedAt.toISOString(),
      durationSeconds: w.durationSeconds,
      user: w.user,
    })),
    _count: content._count,
    mediaChecklist: checklist,
    linkedProject: content.linkedProject
      ? {
          id: content.linkedProject.id,
          title: content.linkedProject.title,
          originalBadge,
          latestPitchStatus: latestPitch?.status ?? null,
        }
      : null,
    creator: content.creator,
  });
}
