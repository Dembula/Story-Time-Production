import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCreatorLicenseType } from "@/lib/pricing";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "MUSIC_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let creatorId = role === "ADMIN"
    ? request.nextUrl.searchParams.get("creatorId") || undefined
    : session?.user?.id;
  if (role === "ADMIN" && !creatorId) {
    const first = await prisma.user.findFirst({ where: { role: "MUSIC_CREATOR" }, select: { id: true } });
    creatorId = first?.id ?? session?.user?.id;
  }

  if (!creatorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tracks = await prisma.musicTrack.findMany({
    where: { creatorId },
    include: {
      _count: { select: { syncDeals: true, syncRequests: true } },
      syncDeals: { include: { content: { select: { title: true } } } },
      syncRequests: {
        where: { status: "PENDING" },
        include: { requester: { select: { name: true } } },
        take: 3,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tracks);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "MUSIC_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { title, artistName, audioUrl, coverUrl, genre, mood, bpm, key, duration, description, tags, isrc, language, licenseType } = body;

  if (!title || !artistName) return NextResponse.json({ error: "title and artistName required" }, { status: 400 });

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
  if (normalizeCreatorLicenseType(license.type) === "YEARLY") {
    if (license.yearlyExpiresAt && license.yearlyExpiresAt < new Date()) {
      return NextResponse.json({ error: "Yearly license expired. Renew to upload." }, { status: 402 });
    }
  } else {
    // Payment gateway has been removed; continue with direct submission.
  }

  const track = await prisma.musicTrack.create({
    data: {
      title, artistName,
      audioUrl: audioUrl || null,
      coverUrl: coverUrl || null,
      genre: genre || null,
      mood: mood || null,
      bpm: bpm ? Number(bpm) : null,
      key: key || null,
      duration: duration ? Number(duration) : null,
      description: description || null,
      tags: tags || null,
      isrc: isrc || null,
      language: language || null,
      licenseType: licenseType || "SYNC",
      creatorId,
    },
  });

  return NextResponse.json(track);
}
