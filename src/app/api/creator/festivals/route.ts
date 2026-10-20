import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  feeForTier,
  festivalAcceptsSubmissions,
  resolveDeadlineTier,
} from "@/lib/festival/constants";
import { packFestivalImageUrl, packFestivalMediaAssetUrl } from "@/lib/festival/media-urls";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const festivals = await prisma.festival.findMany({
    where: {
      status: { in: ["LIVE", "SUBMISSIONS_CLOSED", "ENDED"] },
    },
    orderBy: [{ eventStartsAt: "asc" }, { name: "asc" }],
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      mediaAssets: { orderBy: { sortOrder: "asc" }, take: 3 },
      _count: { select: { categories: true } },
    },
  });

  const items = festivals.map((f) => {
    const tier = resolveDeadlineTier(f);
    const fees = f.categories.map((c) => feeForTier(c, tier));
    const minFee = fees.length ? Math.min(...fees) : null;
    return {
      id: f.id,
      slug: f.slug,
      name: f.name,
      tagline: f.tagline,
      about: f.about,
      yearsRunning: f.yearsRunning,
      logoUrl: packFestivalImageUrl(f.logoUrl) ?? f.logoUrl,
      headerImageUrl: packFestivalImageUrl(f.headerImageUrl) ?? f.headerImageUrl,
      status: f.status,
      acceptingSubmissions: festivalAcceptsSubmissions(f),
      openingAt: f.openingAt,
      earlybirdAt: f.earlybirdAt,
      regularAt: f.regularAt,
      eventStartsAt: f.eventStartsAt,
      eventEndsAt: f.eventEndsAt,
      categoryCount: f._count.categories,
      currentTier: tier,
      fromFeeZar: minFee,
      previewMedia: f.mediaAssets.map((m) => ({ ...m, url: packFestivalMediaAssetUrl(m.url) })),
    };
  });

  return NextResponse.json({ festivals: items });
}
