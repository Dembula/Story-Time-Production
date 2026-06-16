import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCreatorLicensePeriodActive, normalizeCreatorLicenseType } from "@/lib/pricing";
import { validateStorageUrlField } from "@/lib/storage-origin";
import { getStreamAssetsByUrls } from "@/lib/stream-asset-store";
import { linkOrIngestStreamForUrl } from "@/lib/stream-ingest-link";
import { buildStreamIngestMeta } from "@/lib/stream-ingest-meta";
import { creatorIsStudentAtUpload } from "@/lib/student-work";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let creatorId =
    role === "ADMIN"
      ? request.nextUrl.searchParams.get("creatorId") || undefined
      : session?.user?.id;
  if (role === "ADMIN" && !creatorId) {
    const first = await prisma.user.findFirst({ where: { role: "CONTENT_CREATOR" }, select: { id: true } });
    creatorId = first?.id ?? session?.user?.id;
  }

  if (!creatorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const singleId = request.nextUrl.searchParams.get("id");
  if (singleId) {
    const one = await prisma.content.findFirst({
      where: { id: singleId, creatorId },
      include: {
        _count: { select: { watchSessions: true, ratings: true, comments: true } },
        ratings: { select: { score: true } },
        linkedProject: { select: { id: true, title: true } },
      },
    });
    if (!one) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const statuses = await getStreamAssetsByUrls([one.videoUrl, one.trailerUrl]);
    return NextResponse.json({
      ...one,
      stream: {
        video: one.videoUrl ? statuses.get(one.videoUrl.trim()) : undefined,
        trailer: one.trailerUrl ? statuses.get(one.trailerUrl.trim()) : undefined,
      },
    });
  }

  const contents = await prisma.content.findMany({
    where: { creatorId },
    include: {
      _count: { select: { watchSessions: true, ratings: true, comments: true, seasons: true } },
      ratings: { select: { score: true } },
      linkedProject: { select: { id: true, title: true } },
      seasons: {
        orderBy: { seasonNumber: "asc" },
        select: { id: true, seasonNumber: true, title: true, published: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const statuses = await getStreamAssetsByUrls(contents.flatMap((item) => [item.videoUrl, item.trailerUrl]));

  return NextResponse.json(
    contents.map((item) => ({
      ...item,
      stream: {
        video: item.videoUrl ? statuses.get(item.videoUrl.trim()) : undefined,
        trailer: item.trailerUrl ? statuses.get(item.trailerUrl.trim()) : undefined,
      },
    })),
  );
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.title || !body.type) {
    return NextResponse.json({ error: "title and type required" }, { status: 400 });
  }
  const isLongForm = ["SERIES", "SHOW", "PODCAST"].includes(String(body.type));
  if (!isLongForm && !body.videoUrl) {
    return NextResponse.json({ error: "videoUrl required for this content type" }, { status: 400 });
  }
  if (isLongForm && !Array.isArray(body.seasons)) {
    return NextResponse.json({ error: "seasons and episodes required for series content" }, { status: 400 });
  }
  for (const [field, value] of [
    ["posterUrl", body.posterUrl],
    ["backdropUrl", body.backdropUrl],
    ["videoUrl", body.videoUrl],
    ["trailerUrl", body.trailerUrl],
    ["scriptUrl", body.scriptUrl],
  ] as const) {
    const error = validateStorageUrlField(value, field);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }

  const creatorId = session!.user!.id as string;
  const user = await prisma.user.findUnique({
    where: { id: creatorId },
    select: {
      id: true,
      creatorDistributionLicense: {
        select: { type: true, yearlyExpiresAt: true },
      },
    },
  });
  if (!user?.creatorDistributionLicense) {
    return NextResponse.json({ error: "Distribution license required. Complete onboarding first." }, { status: 403 });
  }
  const license = user.creatorDistributionLicense;
  const isDraft = (body.reviewStatus || "DRAFT") === "DRAFT";
  if (normalizeCreatorLicenseType(license.type) === "YEARLY") {
    if (!isCreatorLicensePeriodActive(license)) {
      return NextResponse.json({ error: "Your plan period has ended. Renew to upload." }, { status: 402 });
    }
  } else if (!isDraft) {
    // Payment gateway has been removed; continue with direct submission.
  }

  const minAge = typeof body.minAge === "number" ? Math.max(0, Math.min(21, body.minAge)) : body.minAge != null ? Math.max(0, Math.min(21, parseInt(String(body.minAge), 10) || 0)) : 0;
  const advisory = body.advisory && typeof body.advisory === "object" ? body.advisory : null;

  let linkedProjectId: string | null = null;
  const rawLink = body.linkedProjectId;
  if (rawLink != null && String(rawLink).trim()) {
    const pid = String(rawLink).trim();
    const project = await prisma.originalProject.findUnique({
      where: { id: pid },
      include: { members: { where: { userId: creatorId }, select: { id: true } }, pitches: { where: { creatorId }, select: { id: true } } },
    });
    if (!project) {
      return NextResponse.json({ error: "Linked project not found" }, { status: 400 });
    }
    const allowed =
      role === "ADMIN" || project.members.length > 0 || project.pitches.length > 0;
    if (!allowed) {
      return NextResponse.json({ error: "You are not a member of this project" }, { status: 403 });
    }
    linkedProjectId = pid;
  }

  const videoUrl = isLongForm && Array.isArray(body.seasons) ? null : (body.videoUrl || null);
  const trailerUrl = body.trailerUrl || null;
  const btsVideosInput = Array.isArray(body.btsVideos) ? body.btsVideos : [];
  const btsVideosPrepared = btsVideosInput.map((b: { videoUrl?: unknown; title?: unknown; thumbnail?: unknown; sortOrder?: unknown }) => ({
    ...b,
    videoUrl: typeof b?.videoUrl === "string" ? b.videoUrl : null,
  }));

  const isStudentWork = await creatorIsStudentAtUpload(creatorId);

  const content = await prisma.content.create({
    data: {
      title: body.title,
      description: body.description || null,
      type: body.type,
      posterUrl: body.posterUrl || null,
      backdropUrl: body.backdropUrl || null,
      videoUrl,
      trailerUrl,
      scriptUrl: body.scriptUrl || null,
      category: body.category || null,
      tags: body.tags || null,
      language: body.language || null,
      country: body.country || null,
      ageRating: body.ageRating || null,
      minAge,
      advisory,
      year: body.year ? parseInt(body.year) : null,
      duration: body.duration ? parseInt(body.duration) : null,
      episodes: body.episodes ? parseInt(body.episodes) : null,
      featured: false,
      published: false,
      reviewStatus: body.reviewStatus || "DRAFT",
      submittedAt: body.submittedAt ? new Date(body.submittedAt) : null,
      isStudentWork,
      creatorId,
      ...(linkedProjectId ? { linkedProjectId } : {}),
    },
  });

  if (body.crew && Array.isArray(body.crew)) {
    for (const c of body.crew) {
      if (c.name && c.role) {
        await prisma.crewMember.create({
          data: { name: c.name, role: c.role, contentId: content.id },
        });
      }
    }
  }

  const createdEpisodes: Array<{ id: string; videoUrl: string | null; title: string }> = [];

  if (Array.isArray(body.seasons) && body.seasons.length > 0) {
    for (const season of body.seasons as Array<{
      seasonNumber: number;
      title?: string;
      episodes: Array<{
        episodeNumber: number;
        title: string;
        description?: string | null;
        videoUrl?: string;
        duration?: number | null;
      }>;
    }>) {
      const createdSeason = await prisma.contentSeason.create({
        data: {
          contentId: content.id,
          seasonNumber: season.seasonNumber,
          title: season.title ?? null,
          published: false,
        },
      });
      for (const ep of season.episodes ?? []) {
        if (!ep.videoUrl) continue;
        const videoErr = validateStorageUrlField(ep.videoUrl, "episodes.videoUrl", { allowNull: false });
        if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });
        const createdEpisode = await prisma.contentEpisode.create({
          data: {
            seasonId: createdSeason.id,
            episodeNumber: ep.episodeNumber,
            title: ep.title,
            description: ep.description ?? null,
            videoUrl: ep.videoUrl,
            duration: ep.duration ?? null,
          },
        });
        createdEpisodes.push({
          id: createdEpisode.id,
          videoUrl: createdEpisode.videoUrl,
          title: ep.title,
        });
      }
    }
  }

  let createdBts: Array<{ id: string; videoUrl: string | null }> = [];
  if (btsVideosPrepared.length > 0) {
    for (const clip of btsVideosPrepared as Array<{ videoUrl?: unknown; thumbnail?: unknown }>) {
      const videoErr = validateStorageUrlField(clip.videoUrl, "btsVideos.videoUrl", { allowNull: false });
      if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });
      const thumbErr = validateStorageUrlField(clip.thumbnail, "btsVideos.thumbnail");
      if (thumbErr) return NextResponse.json({ error: thumbErr }, { status: 400 });
    }
    const valid = btsVideosPrepared.filter((b: { title?: unknown; videoUrl?: unknown }) => b.title && b.videoUrl);
    if (valid.length > 0) {
      createdBts = await prisma.$transaction(
        valid.map((b: { title: string; videoUrl: string; thumbnail?: string | null; sortOrder?: number }, index: number) =>
          prisma.btsVideo.create({
            data: {
              title: b.title,
              videoUrl: b.videoUrl,
              thumbnail: b.thumbnail || null,
              sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : index,
              contentId: content.id,
            },
          }),
        ),
      );
    }
  }

  after(async () => {
    const streamMetaBase = buildStreamIngestMeta({
      contentTitle: content.title,
      creatorId,
      contentId: content.id,
      source: "storytime-catalogue",
    });
    const tasks: Promise<void>[] = [];
    if (videoUrl) {
      tasks.push(
        linkOrIngestStreamForUrl(videoUrl, "Content", content.id, {
          ...streamMetaBase,
          area: "content-video",
          name: content.title,
        }),
      );
    }
    if (trailerUrl) {
      tasks.push(
        linkOrIngestStreamForUrl(trailerUrl, "Content", content.id, {
          ...streamMetaBase,
          area: "content-trailer",
          name: `${content.title} (Trailer)`,
        }),
      );
    }
    for (const b of createdBts) {
      if (b.videoUrl) {
        tasks.push(
          linkOrIngestStreamForUrl(b.videoUrl, "BtsVideo", b.id, {
            ...streamMetaBase,
            area: "content-bts",
            name: `${content.title} (BTS)`,
            entityId: b.id,
            entityType: "BtsVideo",
          }),
        );
      }
    }
    for (const episode of createdEpisodes) {
      if (episode.videoUrl) {
        tasks.push(
          linkOrIngestStreamForUrl(episode.videoUrl, "ContentEpisode", episode.id, {
            ...streamMetaBase,
            area: "content-episode",
            episodeTitle: episode.title,
            name: `${content.title} · ${episode.title}`,
            entityId: episode.id,
            entityType: "ContentEpisode",
          }),
        );
      }
    }
    await Promise.all(tasks);
  });

  return NextResponse.json(content);
}
