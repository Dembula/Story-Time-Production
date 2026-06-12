import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateStorageUrlField } from "@/lib/storage-origin";
import { linkOrIngestStreamForUrl } from "@/lib/stream-ingest-link";
import { isLongFormType } from "@/lib/content-types";
import { notifyUser } from "@/lib/notify-user";

type EpisodeInput = {
  episodeNumber: number;
  title: string;
  description?: string | null;
  videoUrl: string;
  duration?: number | null;
};

/** POST: Append a new season (with episodes) to an existing long-form title. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { contentId } = await params;
  const creatorId = session!.user!.id as string;
  const body = await req.json();

  const content = await prisma.content.findFirst({
    where: { id: contentId, creatorId: role === "ADMIN" ? undefined : creatorId },
    include: {
      seasons: { orderBy: { seasonNumber: "desc" }, take: 1, select: { seasonNumber: true } },
    },
  });

  if (!content) {
    return NextResponse.json({ error: "Series not found" }, { status: 404 });
  }

  if (!isLongFormType(content.type)) {
    return NextResponse.json({ error: "Only series, shows, and podcasts support new seasons" }, { status: 400 });
  }

  if (content.reviewStatus !== "APPROVED") {
    return NextResponse.json(
      { error: "Your series must be published before you can add a new season" },
      { status: 400 },
    );
  }

  const episodes = (Array.isArray(body.episodes) ? body.episodes : []) as EpisodeInput[];
  if (episodes.length === 0 || !episodes.every((e) => e.videoUrl && e.title)) {
    return NextResponse.json({ error: "At least one complete episode is required" }, { status: 400 });
  }

  for (const ep of episodes) {
    const videoErr = validateStorageUrlField(ep.videoUrl, "episodes.videoUrl", { allowNull: false });
    if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });
  }

  const nextSeasonNumber = (content.seasons[0]?.seasonNumber ?? 0) + 1;
  const seasonTitle =
    typeof body.seasonTitle === "string" && body.seasonTitle.trim()
      ? body.seasonTitle.trim()
      : `Season ${nextSeasonNumber}`;

  const createdSeason = await prisma.contentSeason.create({
    data: {
      contentId: content.id,
      seasonNumber: nextSeasonNumber,
      title: seasonTitle,
      published: false,
      episodes: {
        create: episodes.map((ep) => ({
          episodeNumber: ep.episodeNumber,
          title: ep.title.trim(),
          description: ep.description?.trim() || null,
          videoUrl: ep.videoUrl,
          duration: ep.duration ?? null,
        })),
      },
    },
    include: { episodes: true },
  });

  const totalEpisodes = await prisma.contentEpisode.count({
    where: { season: { contentId: content.id } },
  });

  await prisma.content.update({
    where: { id: content.id },
    data: {
      reviewStatus: "PENDING",
      reviewNote: `New season submitted: ${seasonTitle} (${episodes.length} episode${episodes.length !== 1 ? "s" : ""}). Awaiting review.`,
      submittedAt: new Date(),
      episodes: totalEpisodes,
    },
  });

  after(async () => {
    for (const ep of createdSeason.episodes) {
      if (ep.videoUrl) {
        await linkOrIngestStreamForUrl(ep.videoUrl, "ContentEpisode", ep.id, {
          area: "content-episode",
          creatorId,
        });
      }
    }
  });

  await notifyUser({
    userId: content.creatorId,
    type: "CONTENT_REVIEW_DECISION",
    title: "New season submitted",
    body: `${seasonTitle} of "${content.title}" was submitted for review.`,
    metadata: { url: `/creator/catalogue/reviews/${content.id}`, contentId: content.id },
  }).catch(() => {});

  return NextResponse.json({
    season: createdSeason,
    seasonNumber: nextSeasonNumber,
    message: `${seasonTitle} submitted for review. It will appear for viewers once approved.`,
  });
}

/** GET: Series info for the add-season upload flow. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { contentId } = await params;
  const creatorId = session!.user!.id as string;

  const content = await prisma.content.findFirst({
    where: { id: contentId, creatorId: role === "ADMIN" ? undefined : creatorId },
    select: {
      id: true,
      title: true,
      type: true,
      description: true,
      posterUrl: true,
      backdropUrl: true,
      reviewStatus: true,
      published: true,
      seasons: {
        orderBy: { seasonNumber: "asc" },
        select: {
          id: true,
          seasonNumber: true,
          title: true,
          published: true,
          _count: { select: { episodes: true } },
        },
      },
    },
  });

  if (!content) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isLongFormType(content.type)) {
    return NextResponse.json({ error: "Not a long-form series title" }, { status: 400 });
  }

  const nextSeasonNumber =
    content.seasons.length > 0
      ? Math.max(...content.seasons.map((s) => s.seasonNumber)) + 1
      : 1;

  return NextResponse.json({
    ...content,
    nextSeasonNumber,
    canAddSeason: content.reviewStatus === "APPROVED",
  });
}
