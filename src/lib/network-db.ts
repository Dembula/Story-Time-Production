/**
 * Creator Network DB layer: follows, connections, posts (Prisma), DMs (raw SQL legacy for conversations).
 */

import { prisma } from "@/lib/prisma";
import type { NetworkPost as NetworkPostModel } from "../../generated/prisma";

export type NetworkPostRow = NetworkPostModel;

export interface CreatorFollowRow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

export interface ConnectionRequestRow {
  id: string;
  fromId: string;
  toId: string;
  status: string;
  message: string | null;
  createdAt: Date;
  respondedAt: Date | null;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const r = await prisma.creatorFollow.findFirst({
    where: { followerId, followingId },
    select: { id: true },
  });
  return !!r;
}

export async function follow(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return;
  await prisma.creatorFollow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    create: { followerId, followingId },
    update: {},
  });
}

export async function unfollow(followerId: string, followingId: string): Promise<void> {
  await prisma.creatorFollow.deleteMany({ where: { followerId, followingId } });
}

export async function getConnectionStatus(
  fromId: string,
  toId: string,
): Promise<"NONE" | "PENDING_SENT" | "PENDING_RECEIVED" | "ACCEPTED" | "DECLINED"> {
  const sent = await prisma.connectionRequest.findFirst({
    where: { fromId, toId },
  });
  if (sent) {
    if (sent.status === "ACCEPTED") return "ACCEPTED";
    if (sent.status === "DECLINED") return "DECLINED";
    return "PENDING_SENT";
  }
  const recv = await prisma.connectionRequest.findFirst({
    where: { fromId: toId, toId: fromId },
  });
  if (recv) {
    if (recv.status === "ACCEPTED") return "ACCEPTED";
    if (recv.status === "DECLINED") return "DECLINED";
    return "PENDING_RECEIVED";
  }
  return "NONE";
}

export async function sendConnectionRequest(fromId: string, toId: string, message?: string): Promise<void> {
  if (fromId === toId) return;
  await prisma.connectionRequest.upsert({
    where: { fromId_toId: { fromId, toId } },
    create: { fromId, toId, message: message ?? null, status: "PENDING" },
    update: { message: message ?? undefined },
  });
}

export async function acceptConnectionRequest(requestId: string, respondentId: string): Promise<void> {
  await prisma.connectionRequest.updateMany({
    where: { id: requestId, toId: respondentId, status: "PENDING" },
    data: { status: "ACCEPTED", respondedAt: new Date() },
  });
}

export async function declineConnectionRequest(requestId: string, respondentId: string): Promise<void> {
  await prisma.connectionRequest.updateMany({
    where: { id: requestId, toId: respondentId, status: "PENDING" },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
}

export async function areConnected(userId1: string, userId2: string): Promise<boolean> {
  const r = await prisma.connectionRequest.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { fromId: userId1, toId: userId2 },
        { fromId: userId2, toId: userId1 },
      ],
    },
    select: { id: true },
  });
  return !!r;
}

export type CreateNetworkPostInput = {
  body?: string | null;
  imageUrls?: string | null;
  videoUrls?: string | null;
  contentId?: string | null;
  projectId?: string | null;
  sceneId?: string | null;
  productionPhase?: string | null;
  postType?: string;
  metadata?: string | null;
};

export async function createNetworkPost(authorId: string, input: CreateNetworkPostInput): Promise<NetworkPostRow> {
  return prisma.networkPost.create({
    data: {
      authorId,
      body: input.body ?? null,
      imageUrls: input.imageUrls ?? null,
      videoUrls: input.videoUrls ?? null,
      contentId: input.contentId ?? null,
      projectId: input.projectId ?? null,
      sceneId: input.sceneId ?? null,
      productionPhase: input.productionPhase ?? null,
      postType: input.postType ?? "TEXT_UPDATE",
      metadata: input.metadata ?? null,
    },
  });
}

/** @deprecated use createNetworkPost */
export async function createPost(
  authorId: string,
  body: string | null,
  imageUrls: string | null,
  contentId: string | null,
  projectId: string | null,
): Promise<NetworkPostRow> {
  return createNetworkPost(authorId, { body, imageUrls, contentId, projectId, postType: "TEXT_UPDATE" });
}

export async function getFeedPostIdsForUser(userId: string, limit: number): Promise<string[]> {
  const following = await prisma.creatorFollow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const ids = following.map((f) => f.followingId);
  if (ids.length === 0) return [];
  const posts = await prisma.networkPost.findMany({
    where: { authorId: { in: ids } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });
  return posts.map((p) => p.id);
}

export async function getPublicFeedPostIds(limit: number): Promise<string[]> {
  const posts = await prisma.networkPost.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true },
  });
  return posts.map((p) => p.id);
}

export async function getPostsByIds(ids: string[]): Promise<NetworkPostRow[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.networkPost.findMany({
    where: { id: { in: ids } },
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getPostsByAuthorId(authorId: string, limit: number): Promise<NetworkPostRow[]> {
  return prisma.networkPost.findMany({
    where: { authorId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getConnectionRequestsReceived(userId: string): Promise<ConnectionRequestRow[]> {
  return prisma.connectionRequest.findMany({
    where: { toId: userId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

export async function getConnectionRequestsSent(userId: string): Promise<ConnectionRequestRow[]> {
  return prisma.connectionRequest.findMany({
    where: { fromId: userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  const rows = await prisma.creatorFollow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  return rows.map((r) => r.followingId);
}

export async function getFollowerCount(userId: string): Promise<number> {
  return prisma.creatorFollow.count({ where: { followingId: userId } });
}

export async function getFollowingCount(userId: string): Promise<number> {
  return prisma.creatorFollow.count({ where: { followerId: userId } });
}
