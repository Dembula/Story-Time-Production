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
import { enrichNetworkPostsForFeed } from "@/lib/network-post-enrich";

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
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
      previousWork: true,
      role: true,
      headline: true,
      location: true,
      website: true,
      networkProfilePublic: true,
      createdAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.networkProfilePublic === false && session?.user?.id !== userId && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Profile is private" }, { status: 403 });
  }

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

  const networkPostRows = await getPostsByAuthorId(userId, 30);
  const posts = await enrichNetworkPostsForFeed(networkPostRows, session?.user?.id ?? null);

  return NextResponse.json({
    user,
    following,
    connectionStatus,
    followerCount,
    followingCount,
    contents,
    posts,
  });
}
