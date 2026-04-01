import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCreatorLicenseType } from "@/lib/pricing";

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

  const contents = await prisma.content.findMany({
    where: { creatorId },
    include: {
      _count: { select: { watchSessions: true, ratings: true, comments: true } },
      ratings: { select: { score: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(contents);
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

  const creatorId = session!.user!.id as string;
  const user = await prisma.user.findUnique({
    where: { id: creatorId },
    include: { creatorDistributionLicense: true },
  });
  if (!user?.creatorDistributionLicense) {
    return NextResponse.json({ error: "Distribution license required. Complete onboarding first." }, { status: 403 });
  }
  const license = user.creatorDistributionLicense;
  const isDraft = (body.reviewStatus || "DRAFT") === "DRAFT";
  if (normalizeCreatorLicenseType(license.type) === "YEARLY") {
    if (license.yearlyExpiresAt && license.yearlyExpiresAt < new Date()) {
      return NextResponse.json({ error: "Yearly license expired. Renew to upload." }, { status: 402 });
    }
  } else if (!isDraft) {
    // Payment gateway has been removed; continue with direct submission.
  }

  const minAge = typeof body.minAge === "number" ? Math.max(0, Math.min(21, body.minAge)) : body.minAge != null ? Math.max(0, Math.min(21, parseInt(String(body.minAge), 10) || 0)) : 0;
  const advisory = body.advisory && typeof body.advisory === "object" ? body.advisory : null;

  const content = await prisma.content.create({
    data: {
      title: body.title,
      description: body.description || null,
      type: body.type,
      posterUrl: body.posterUrl || null,
      backdropUrl: body.backdropUrl || null,
      videoUrl: body.videoUrl || null,
      trailerUrl: body.trailerUrl || null,
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

  if (body.btsVideos && Array.isArray(body.btsVideos)) {
    const valid = body.btsVideos.filter((b: any) => b.title && b.videoUrl);
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
    }
  }

  return NextResponse.json(content);
}
