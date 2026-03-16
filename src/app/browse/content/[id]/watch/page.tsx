import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WatchClient } from "./watch-client";

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

  const profileId = cookies().get("st_viewer_profile")?.value;
  if (!profileId) {
    redirect("/profiles");
  }

  let profileAge: number | null = null;
  const profile = await prisma.viewerProfile.findFirst({
    where: { id: profileId, userId: session.user.id },
    select: { age: true },
  });
  if (profile) profileAge = profile.age;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { viewerSubscriptions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const sub = user?.viewerSubscriptions?.[0];
  let subscriptionExpired = true;
  if (sub) {
    const trialExpired = sub.status === "TRIAL_ACTIVE" && sub.trialEndsAt && new Date(sub.trialEndsAt) < new Date();
    const periodExpired = sub.status === "ACTIVE" && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date();
    subscriptionExpired = trialExpired || periodExpired || sub.status === "PAST_DUE" || sub.status === "CANCELLED";
  } else {
    redirect("/onboarding/package");
  }

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

  const minAge = content.minAge ?? 0;
  const ageRestricted = profileAge != null && minAge > profileAge;
  if (ageRestricted || subscriptionExpired) {
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
