import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  isFollowing,
  getConnectionStatus,
  getFollowerCount,
  getFollowingCount,
  getPostsByAuthorId,
} from "@/lib/network-db";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
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
      role: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [headlineLocationWebsite] = await prisma
    .$queryRawUnsafe<{ headline: string | null; location: string | null; website: string | null }[]>(
      `SELECT "headline", "location", "website" FROM "User" WHERE "id" = $1`,
      userId
    )
    .catch(() => [{} as { headline: null; location: null; website: null }]);

  const [following, connectionStatus, followerCount, followingCount] = session?.user?.id
    ? await Promise.all([
        isFollowing(session.user.id, userId),
        getConnectionStatus(session.user.id, userId),
        getFollowerCount(userId),
        getFollowingCount(userId),
      ])
    : [false, "NONE" as const, await getFollowerCount(userId), await getFollowingCount(userId)];

  const contents = await prisma.content.findMany({
    where: { creatorId: userId, published: true },
    select: { id: true, title: true, type: true, posterUrl: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const pitches = await prisma.originalPitch.findMany({
    where: { creatorId: userId },
    select: { id: true, title: true, type: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const memberships = await prisma.originalMember.findMany({
    where: { userId },
    include: { project: { select: { id: true, title: true, type: true, status: true } } },
    take: 8,
  });

  const networkPosts = await getPostsByAuthorId(userId, 20);

  return NextResponse.json({
    user: {
      ...user,
      headline: headlineLocationWebsite?.headline ?? null,
      location: headlineLocationWebsite?.location ?? null,
      website: headlineLocationWebsite?.website ?? null,
    },
    following,
    connectionStatus,
    followerCount,
    followingCount,
    contents,
    pitches,
    memberships: memberships.map((m) => ({ ...m, project: m.project })),
    posts: networkPosts,
  });
}
