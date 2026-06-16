import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { ContentDetailClient } from "./content-detail-client";
import { getViewerPlaybackState, isPpvEligibleContent } from "@/lib/viewer-access";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import type { SeasonItem } from "@/components/browse/content-episodes-section";

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

  const content = await prisma.content.findUnique({
    where: { id, published: true },
    include: {
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
          isAfdaStudent: true,
        },
      },
      btsVideos: { orderBy: { sortOrder: "asc" } },
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
      crewMembers: { orderBy: { createdAt: "asc" } },
      seasons: {
        where: { published: true },
        orderBy: { seasonNumber: "asc" },
        include: {
          episodes: { orderBy: { episodeNumber: "asc" } },
        },
      },
    },
  });

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

  return (
    <ContentDetailClient
      content={{
        ...content,
        createdAt: content.createdAt.toISOString(),
        submittedAt: content.submittedAt?.toISOString() ?? null,
        ratingStats: {
          average: avgRating._avg.score ?? 0,
          count: avgRating._count,
        },
        otherCreatorContent,
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
  );
}
