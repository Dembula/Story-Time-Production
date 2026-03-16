import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { ContentDetailClient } from "./content-detail-client";

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  let subscriptionExpired = false;
  let profileAge: number | null = null;
  if (session?.user?.id && (session.user as { role?: string })?.role === "SUBSCRIBER") {
    const profileId = cookies().get("st_viewer_profile")?.value;
    if (profileId) {
      const profile = await prisma.viewerProfile.findFirst({
        where: { id: profileId, userId: session.user.id },
        select: { age: true },
      });
      if (profile) profileAge = profile.age;
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { viewerSubscriptions: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const sub = user?.viewerSubscriptions?.[0];
    if (sub) {
      const trialExpired = sub.status === "TRIAL_ACTIVE" && sub.trialEndsAt && new Date(sub.trialEndsAt) < new Date();
      const periodExpired = sub.status === "ACTIVE" && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date();
      subscriptionExpired = trialExpired || periodExpired || sub.status === "PAST_DUE" || sub.status === "CANCELLED";
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
    },
  });

  if (!content) notFound();

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

  return (
    <ContentDetailClient
      content={{
        ...content,
        ratingStats: {
          average: avgRating._avg.score ?? 0,
          count: avgRating._count,
        },
        otherCreatorContent,
        soundtrack: content.syncDeals.map((sd) => sd.musicTrack),
        crewMembers: content.crewMembers,
      }}
      subscriptionExpired={subscriptionExpired}
      ageRestricted={ageRestricted}
      contentMinAge={minAge}
    />
  );
}
