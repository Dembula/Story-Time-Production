import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isReadyStreamStatus } from "@/lib/content-approve-publish";

async function ensureAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return {
      error: NextResponse.json({ error: "Not found" }, { status: 404 }),
      userId: null as string | null,
    };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId };
}

const reviewInclude = {
  cutAsset: true,
  notes: {
    orderBy: { createdAt: "asc" as const },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  },
};

/** Merge ready StreamAsset URLs into FootageAsset.metadata for edit playback. */
async function enrichReviewsWithStreamPlayback<
  T extends {
    cutAsset: { id: string; metadata: string | null; fileUrl: string } | null;
  },
>(reviews: T[]): Promise<T[]> {
  const assetIds = reviews
    .map((r) => r.cutAsset?.id)
    .filter((id): id is string => Boolean(id));
  if (assetIds.length === 0) return reviews;

  const streams = await prisma.streamAsset.findMany({
    where: {
      entityType: "FootageAsset",
      entityId: { in: assetIds },
    },
    select: {
      entityId: true,
      hlsUrl: true,
      playbackUrl: true,
      status: true,
      uid: true,
    },
  });

  const byAsset = new Map(
    streams
      .filter((s) => s.entityId && isReadyStreamStatus(s.status) && (s.hlsUrl || s.playbackUrl))
      .map((s) => [s.entityId!, s]),
  );

  return reviews.map((review) => {
    const asset = review.cutAsset;
    if (!asset) return review;
    const stream = byAsset.get(asset.id);
    if (!stream) return review;

    let meta: Record<string, unknown> = {};
    if (asset.metadata?.trim()) {
      try {
        meta = JSON.parse(asset.metadata) as Record<string, unknown>;
      } catch {
        meta = {};
      }
    }
    if (meta.hlsUrl || meta.playbackUrl) return review;

    const enriched = {
      ...meta,
      hlsUrl: stream.hlsUrl ?? undefined,
      playbackUrl: stream.playbackUrl ?? stream.hlsUrl ?? undefined,
      proxyUrl: stream.playbackUrl ?? stream.hlsUrl ?? undefined,
      streamUid: stream.uid,
      streamStatus: stream.status,
    };

    return {
      ...review,
      cutAsset: {
        ...asset,
        metadata: JSON.stringify(enriched),
      },
    };
  });
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const reviews = await prisma.postProductionReview.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: reviewInclude,
  });

  const enriched = await enrichReviewsWithStreamPlayback(reviews);
  return NextResponse.json({ reviews: enriched });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        cutAssetId?: string;
        title?: string;
      }
    | null;

  if (body?.cutAssetId) {
    const asset = await prisma.footageAsset.findFirst({
      where: { id: body.cutAssetId, projectId },
    });
    if (!asset) {
      return NextResponse.json({ error: "cutAssetId not found on project" }, { status: 400 });
    }

    const existing = await prisma.postProductionReview.findFirst({
      where: { projectId, cutAssetId: body.cutAssetId },
      include: reviewInclude,
    });
    if (existing) {
      const [enriched] = await enrichReviewsWithStreamPlayback([existing]);
      return NextResponse.json({ review: enriched }, { status: 200 });
    }
  }

  const review = await prisma.postProductionReview.create({
    data: {
      projectId,
      cutAssetId: body?.cutAssetId ?? null,
      title: body?.title?.trim() || null,
    },
    include: reviewInclude,
  });

  return NextResponse.json({ review }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        id: string;
        status?: string;
        title?: string;
      }
    | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const existing = await prisma.postProductionReview.findFirst({
    where: { id: body.id, projectId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const review = await prisma.postProductionReview.update({
    where: { id: body.id },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.title !== undefined ? { title: body.title.trim() || null } : {}),
    },
    include: reviewInclude,
  });

  const [enriched] = await enrichReviewsWithStreamPlayback([review]);
  return NextResponse.json({ review: enriched });
}
