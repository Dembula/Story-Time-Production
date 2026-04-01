import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WatchClient } from "./watch-client";
import { getViewerPlaybackState } from "@/lib/viewer-access";
import { getViewerProfileAge } from "@/lib/viewer-profiles";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
      posterUrl: true,
      backdropUrl: true,
      type: true,
      language: true,
      creatorId: true,
      minAge: true,
      createdAt: true,
    },
  });

  if (!content || !content.videoUrl) notFound();

  const playback = await getViewerPlaybackState(session.user.id, content.id);
  if (!playback.subscription) {
    redirect("/onboarding/package");
  }

  const minAge = content.minAge ?? 0;
  const ageRestricted = profileAge != null && minAge > profileAge;
  if (ageRestricted || !playback.canPlayContent) {
    redirect(`/browse/content/${id}`);
  }

  // Next episode: same creator, same type (e.g. Series), published, after this by createdAt
  const isSeriesLike = /series|show|anthology/i.test(content.type || "");
  let nextEpisode: { id: string; title: string } | null = null;
  if (isSeriesLike) {
    const next = await prisma.content.findFirst({
      where: {
        creatorId: content.creatorId,
        published: true,
        id: { not: content.id },
        videoUrl: { not: null },
        createdAt: { gt: content.createdAt },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true },
    });
    if (next) nextEpisode = { id: next.id, title: next.title };
  }

  return (
    <WatchClient
      content={{
        id: content.id,
        title: content.title,
        videoUrl: content.videoUrl,
        posterUrl: content.posterUrl,
        backdropUrl: content.backdropUrl,
        language: content.language,
        type: content.type,
      }}
      contentDetailUrl={`/browse/content/${content.id}`}
      nextEpisode={nextEpisode}
    />
  );
}
