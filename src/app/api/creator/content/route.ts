import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isCreatorLicensePeriodActive, normalizeCreatorLicenseType } from "@/lib/pricing";
import { validateStorageUrlField } from "@/lib/storage-origin";
import { ensureCloudflareStreamPlaybackUrl, extractCloudflareStreamUid } from "@/lib/cloudflare-stream";
import { setStreamAssetEntity, getStreamStatusesByUids } from "@/lib/stream-asset-store";

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
    const uids = [extractCloudflareStreamUid(one.videoUrl), extractCloudflareStreamUid(one.trailerUrl)].filter(
      (v): v is string => Boolean(v),
    );
    const statuses = await getStreamStatusesByUids(uids);
    return NextResponse.json({
      ...one,
      stream: {
        video: statuses.get(extractCloudflareStreamUid(one.videoUrl) ?? ""),
        trailer: statuses.get(extractCloudflareStreamUid(one.trailerUrl) ?? ""),
      },
    });
  }

  const contents = await prisma.content.findMany({
    where: { creatorId },
    include: {
      _count: { select: { watchSessions: true, ratings: true, comments: true } },
      ratings: { select: { score: true } },
      linkedProject: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const allUids = contents.flatMap((item) =>
    [extractCloudflareStreamUid(item.videoUrl), extractCloudflareStreamUid(item.trailerUrl)].filter(
      (v): v is string => Boolean(v),
    ),
  );
  const statuses = await getStreamStatusesByUids(allUids);

  return NextResponse.json(
    contents.map((item) => ({
      ...item,
      stream: {
        video: statuses.get(extractCloudflareStreamUid(item.videoUrl) ?? ""),
        trailer: statuses.get(extractCloudflareStreamUid(item.trailerUrl) ?? ""),
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

  const videoUrl = await ensureCloudflareStreamPlaybackUrl(body.videoUrl || null, {
    area: "content-video",
    creatorId,
  });
  const trailerUrl = await ensureCloudflareStreamPlaybackUrl(body.trailerUrl || null, {
    area: "content-trailer",
    creatorId,
  });
  const btsVideosInput = Array.isArray(body.btsVideos) ? body.btsVideos : [];
  const btsVideosPrepared = await Promise.all(
    btsVideosInput.map(async (b: any) => ({
      ...b,
      videoUrl: await ensureCloudflareStreamPlaybackUrl(b?.videoUrl ?? null, {
        area: "content-bts",
        creatorId,
      }),
    })),
  );

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
      creatorId,
      ...(linkedProjectId ? { linkedProjectId } : {}),
    },
  });

  for (const streamUrl of [videoUrl, trailerUrl]) {
    const uid = extractCloudflareStreamUid(streamUrl);
    if (uid) await setStreamAssetEntity(uid, "Content", content.id);
  }

  if (body.crew && Array.isArray(body.crew)) {
    for (const c of body.crew) {
      if (c.name && c.role) {
        await prisma.crewMember.create({
          data: { name: c.name, role: c.role, contentId: content.id },
        });
      }
    }
  }

  if (btsVideosPrepared.length > 0) {
    for (const clip of btsVideosPrepared as Array<{ videoUrl?: unknown; thumbnail?: unknown }>) {
      const videoErr = validateStorageUrlField(clip.videoUrl, "btsVideos.videoUrl", { allowNull: false });
      if (videoErr) return NextResponse.json({ error: videoErr }, { status: 400 });
      const thumbErr = validateStorageUrlField(clip.thumbnail, "btsVideos.thumbnail");
      if (thumbErr) return NextResponse.json({ error: thumbErr }, { status: 400 });
    }
    const valid = btsVideosPrepared.filter((b: any) => b.title && b.videoUrl);
    if (valid.length > 0) {
      await prisma.$transaction(
        valid.map((b: any, index: number) =>
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
      for (const b of valid) {
        const uid = extractCloudflareStreamUid(b.videoUrl ?? null);
        if (uid) await setStreamAssetEntity(uid, "Content", content.id);
      }
    }
  }

  return NextResponse.json(content);
}
