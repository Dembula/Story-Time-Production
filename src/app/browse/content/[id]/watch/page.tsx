import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WatchClient } from "./watch-client";
import { getViewerPlaybackState } from "@/lib/viewer-access";
import { getViewerProfileAge } from "@/lib/viewer-profiles";
import { isLongFormType } from "@/lib/content-types";

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ episode?: string; trailer?: string; offline?: string }>;
}) {
  const { id } = await params;
  const { episode: episodeId, trailer, offline } = await searchParams;
  const isTrailer = trailer === "1";
  const offlineRequested = offline === "1";

  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;

  if (!session?.user?.id || role !== "SUBSCRIBER") {
    redirect(`/browse/content/${id}`);
  }

  const cookieStore = await cookies();
  const profileId = cookieStore.get("st_viewer_profile")?.value;
  if (!profileId) {
    redirect("/profiles");
  }

  let profileAge: number | null = null;
  const profile = await prisma.viewerProfile.findFirst({
    where: { id: profileId, userId: session.user.id },
    select: { age: true, dateOfBirth: true },
  });
  if (profile) profileAge = getViewerProfileAge(profile);

  const content = await prisma.content.findUnique({
    where: { id, published: true },
    select: {
      id: true,
      title: true,
      videoUrl: true,
      trailerUrl: true,
      posterUrl: true,
      backdropUrl: true,
      type: true,
      language: true,
      creatorId: true,
      minAge: true,
      ageRating: true,
      advisory: true,
      duration: true,
      createdAt: true,
      seasons: {
        where: { published: true },
        orderBy: { seasonNumber: "asc" },
        include: { episodes: { orderBy: { episodeNumber: "asc" } } },
      },
    },
  });

  if (!content) notFound();

  let videoUrl = isTrailer ? content.trailerUrl : content.videoUrl;
  let displayTitle = isTrailer ? `${content.title} · Official Trailer` : content.title;
  let episodeDuration = content.duration;
  let progressContentId = content.id;

  if (!isTrailer && episodeId) {
    const episode = content.seasons.flatMap((s) => s.episodes).find((e) => e.id === episodeId);
    if (!episode?.videoUrl) notFound();
    videoUrl = episode.videoUrl;
    displayTitle = `${content.title} · ${episode.title}`;
    episodeDuration = episode.duration;
    progressContentId = content.id;
  } else if (!isTrailer && isLongFormType(content.type) && !content.videoUrl) {
    const firstEp = content.seasons.flatMap((s) => s.episodes).find((e) => e.videoUrl);
    if (firstEp) {
      videoUrl = firstEp.videoUrl;
      displayTitle = `${content.title} · ${firstEp.title}`;
      episodeDuration = firstEp.duration;
    }
  }

  if (!videoUrl) notFound();

  const playback = await getViewerPlaybackState(session.user.id, content.id);
  if (!playback.subscription) {
    redirect("/onboarding/package");
  }

  const minAge = content.minAge ?? 0;
  const ageRestricted = profileAge != null && minAge > profileAge;
  if (ageRestricted || !playback.canPlayContent) {
    redirect(`/browse/content/${id}`);
  }

  let nextEpisode: { id: string; title: string; href: string } | null = null;
  if (!isTrailer && isLongFormType(content.type)) {
    const allEpisodes = content.seasons.flatMap((s) =>
      s.episodes.map((e) => ({ ...e, seasonNumber: s.seasonNumber })),
    );
    const currentIdx = episodeId
      ? allEpisodes.findIndex((e) => e.id === episodeId)
      : allEpisodes.findIndex((e) => e.videoUrl === videoUrl);
    const next = currentIdx >= 0 ? allEpisodes[currentIdx + 1] : allEpisodes[0];
    if (next?.videoUrl) {
      nextEpisode = {
        id: next.id,
        title: next.title,
        href: `/browse/content/${content.id}/watch?episode=${next.id}`,
      };
    }
  }

  let startTime = 0;
  if (!isTrailer) {
    const progress = await prisma.watchProgress.findUnique({
      where: {
        viewerProfileId_contentId: { viewerProfileId: profileId, contentId: progressContentId },
      },
      select: { positionSeconds: true, durationSeconds: true },
    });
    if (progress && progress.positionSeconds >= 30) {
      const dur = progress.durationSeconds ?? episodeDuration ?? null;
      if (!dur || progress.positionSeconds / dur < 0.92) {
        startTime = progress.positionSeconds;
      }
    }
  }

  return (
    <WatchClient
      content={{
        id: content.id,
        title: displayTitle,
        videoUrl,
        posterUrl: content.posterUrl,
        backdropUrl: content.backdropUrl,
        language: content.language,
        type: content.type,
        ageRating: content.ageRating,
        minAge: content.minAge ?? 0,
        advisory: (content.advisory as Record<string, unknown> | null) ?? null,
      }}
      contentDetailUrl={`/browse/content/${content.id}`}
      nextEpisode={nextEpisode ? { id: nextEpisode.id, title: nextEpisode.title, href: nextEpisode.href } : null}
      startTime={startTime}
      episodeId={!isTrailer && episodeId ? episodeId : null}
      isTrailer={isTrailer}
      offlineRequested={offlineRequested}
    />
  );
}
