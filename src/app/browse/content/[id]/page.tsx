import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { ContentDetailClient } from "./content-detail-client";
import { getViewerPlaybackState, isPpvEligibleContent } from "@/lib/viewer-access";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import type { SeasonItem } from "@/components/browse/content-episodes-section";
import { packPlatformImageUrl } from "@/lib/browse-media-pack";
import {
  buildContentJsonLd,
  buildTrailerVideoObjectJsonLd,
  jsonLdScriptContent,
} from "@/lib/seo/content-json-ld";
import { buildContentPageMetadata } from "@/lib/seo/content-metadata";

export const dynamic = "force-dynamic";

async function packCatalogueImage(url: string | null | undefined): Promise<string | null> {
  if (!url?.trim()) return null;
  return packPlatformImageUrl(url);
}

const contentDetailInclude = {
  creator: {
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      socialLinks: true,
      education: true,
      goals: true,
      previousWork: true,
      institutionName: true,
      showCreatorAboutOnTitles: true,
      isAfdaStudent: true,
    },
  },
  btsVideos: { orderBy: { sortOrder: "asc" as const } },
  syncDeals: {
    include: {
      musicTrack: {
        select: {
          id: true,
          title: true,
          artistName: true,
          genre: true,
          coverUrl: true,
          creatorId: true,
        },
      },
    },
  },
  crewMembers: {
    orderBy: { createdAt: "asc" as const },
    include: {
      creditPerson: {
        select: { id: true, imageUrl: true, userId: true },
      },
    },
  },
  seasons: {
    where: { published: true },
    orderBy: { seasonNumber: "asc" as const },
    include: {
      episodes: { orderBy: { episodeNumber: "asc" as const } },
    },
  },
} as const;

async function loadPublishedContent(id: string) {
  return prisma.content.findUnique({
    where: { id, published: true },
    include: contentDetailInclude,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const content = await prisma.content.findUnique({
    where: { id, published: true },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      posterUrl: true,
      category: true,
      year: true,
    },
  });
  // Taken-down / unpublished titles: noindex fallback (page itself 404s).
  if (!content) {
    return { title: "Title unavailable", robots: { index: false, follow: false } };
  }
  return buildContentPageMetadata(content);
}

export default async function ContentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ play?: string; from?: string }>;
}) {
  const { id } = await params;
  const { play, from } = await searchParams;
  const autoPlay = play === "1";
  const fromDiscover = from === "discover";

  const session = await getServerSession(authOptions);
  let subscriptionExpired = false;
  let profileAge: number | null = null;
  let viewerModel: "SUBSCRIPTION" | "PPV" = "SUBSCRIPTION";
  let hasActivePpvAccess = false;
  let hasPlaybackAccess = false;
  if (session?.user?.id && (session.user as { role?: string })?.role === "SUBSCRIBER") {
    const cookieStore = await cookies();
    const profileId = cookieStore.get("st_viewer_profile")?.value;
    if (profileId) {
      const profile = await prisma.viewerProfile.findFirst({
        where: { id: profileId, userId: session.user.id },
        select: { age: true, dateOfBirth: true },
      });
      if (profile) profileAge = getViewerProfileAge(profile);
    }
  }

  const content = await loadPublishedContent(id);

  if (!content) notFound();

  if (session?.user?.id && (session.user as { role?: string })?.role === "SUBSCRIBER") {
    const playback = await getViewerPlaybackState(session.user.id, content.id);
    viewerModel = playback.viewerModel;
    subscriptionExpired = playback.viewerModel === "SUBSCRIPTION" ? playback.subscriptionExpired : false;
    hasActivePpvAccess = playback.hasActivePpvAccess;
    hasPlaybackAccess = playback.canPlayContent;
  }

  const minAge = content.minAge ?? 0;
  const ageRestricted = profileAge != null && minAge > profileAge;

  const avgRating = await prisma.rating.aggregate({
    where: { contentId: id },
    _avg: { score: true },
    _count: true,
  });

  const otherCreatorContent = await prisma.content.findMany({
    where: { creatorId: content.creatorId, id: { not: id }, published: true },
    take: 6,
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, posterUrl: true, type: true, year: true },
  });

  const relatedContent = await prisma.content.findMany({
    where: {
      id: { not: id },
      published: true,
      OR: [
        content.category ? { category: content.category } : undefined,
        { type: content.type },
      ].filter(Boolean) as Array<Record<string, unknown>>,
    },
    take: 14,
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    select: { id: true, title: true, posterUrl: true, type: true, year: true },
  });

  const seasons: SeasonItem[] = content.seasons.map((s) => ({
    id: s.id,
    seasonNumber: s.seasonNumber,
    title: s.title,
    episodes: s.episodes.map((e) => ({
      id: e.id,
      episodeNumber: e.episodeNumber,
      title: e.title,
      description: e.description,
      videoUrl: e.videoUrl,
      thumbnailUrl: e.thumbnailUrl,
      duration: e.duration,
    })),
  }));

  const seoInput = {
    id: content.id,
    title: content.title,
    description: content.description,
    type: content.type,
    posterUrl: content.posterUrl,
    backdropUrl: content.backdropUrl,
    trailerUrl: content.trailerUrl,
    category: content.category,
    tags: content.tags,
    language: content.language,
    country: content.country,
    ageRating: content.ageRating,
    minAge: content.minAge,
    year: content.year,
    duration: content.duration,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt,
    creator: content.creator,
    crewMembers: content.crewMembers.map((c) => ({
      name: c.name,
      role: c.role,
      creditPersonId: c.creditPersonId ?? c.creditPerson?.id ?? null,
    })),
  };
  const movieJsonLd = buildContentJsonLd(seoInput);
  const trailerJsonLd = buildTrailerVideoObjectJsonLd(seoInput);
  const jsonLdPayload = trailerJsonLd ? [movieJsonLd, trailerJsonLd] : movieJsonLd;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(jsonLdPayload) }}
      />
      <ContentDetailClient
        content={{
          ...content,
          posterUrl: await packCatalogueImage(content.posterUrl),
          backdropUrl:
            (await packCatalogueImage(content.backdropUrl)) ?? content.backdropUrl,
          createdAt: content.createdAt.toISOString(),
          submittedAt: content.submittedAt?.toISOString() ?? null,
          ratingStats: {
            average: avgRating._avg.score ?? 0,
            count: avgRating._count,
          },
          otherCreatorContent: await Promise.all(
            otherCreatorContent.map(async (c) => ({
              ...c,
              posterUrl: await packCatalogueImage(c.posterUrl),
            })),
          ),
          relatedContent: await Promise.all(
            relatedContent.map(async (c) => ({
              ...c,
              posterUrl: await packCatalogueImage(c.posterUrl),
            })),
          ),
          soundtrack: content.syncDeals.map((sd) => sd.musicTrack),
          crewMembers: content.crewMembers,
        }}
        seasons={seasons}
        autoPlay={autoPlay}
        subscriptionExpired={subscriptionExpired}
        ageRestricted={ageRestricted}
        contentMinAge={minAge}
        viewerModel={viewerModel}
        hasActivePpvAccess={hasActivePpvAccess}
        hasPlaybackAccess={hasPlaybackAccess}
        ppvEligible={isPpvEligibleContent(content.type)}
        fromDiscover={fromDiscover}
      />
    </>
  );
}
