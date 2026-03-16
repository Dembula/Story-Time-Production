/**
 * Network (social) DB layer using raw SQL so it works even if Prisma schema
 * has validation issues. Tables: CreatorFollow, ConnectionRequest, NetworkPost,
 * NetworkConversation, NetworkConversationParticipant, NetworkMessage.
 */

import { prisma } from "@/lib/prisma";

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface NetworkPostRow {
  id: string;
  authorId: string;
  body: string | null;
  imageUrls: string | null;
  contentId: string | null;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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
  const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT 1 as n FROM "CreatorFollow" WHERE "followerId" = $1 AND "followingId" = $2 LIMIT 1`,
    followerId,
    followingId
  );
  return r.length > 0;
}

export async function follow(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CreatorFollow" ("id", "followerId", "followingId", "createdAt")
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT ("followerId", "followingId") DO NOTHING`,
    id(),
    followerId,
    followingId
  );
}

export async function unfollow(followerId: string, followingId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "CreatorFollow" WHERE "followerId" = $1 AND "followingId" = $2`,
    followerId,
    followingId
  );
}

export async function getConnectionStatus(
  fromId: string,
  toId: string
): Promise<"NONE" | "PENDING_SENT" | "PENDING_RECEIVED" | "ACCEPTED" | "DECLINED"> {
  const sent = await prisma.$queryRawUnsafe<ConnectionRequestRow[]>(
    `SELECT * FROM "ConnectionRequest" WHERE "fromId" = $1 AND "toId" = $2 LIMIT 1`,
    fromId,
    toId
  );
  if (sent.length) {
    const s = sent[0].status;
    if (s === "ACCEPTED") return "ACCEPTED";
    if (s === "DECLINED") return "DECLINED";
    return "PENDING_SENT";
  }
  const recv = await prisma.$queryRawUnsafe<ConnectionRequestRow[]>(
    `SELECT * FROM "ConnectionRequest" WHERE "fromId" = $1 AND "toId" = $2 LIMIT 1`,
    toId,
    fromId
  );
  if (recv.length) {
    const s = recv[0].status;
    if (s === "ACCEPTED") return "ACCEPTED";
    if (s === "DECLINED") return "DECLINED";
    return "PENDING_RECEIVED";
  }
  return "NONE";
}

export async function sendConnectionRequest(
  fromId: string,
  toId: string,
  message?: string
): Promise<void> {
  if (fromId === toId) return;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ConnectionRequest" ("id", "fromId", "toId", "status", "message", "createdAt")
     VALUES ($1, $2, $3, 'PENDING', $4, NOW())
     ON CONFLICT ("fromId", "toId") DO NOTHING`,
    id(),
    fromId,
    toId,
    message ?? null
  );
}

export async function acceptConnectionRequest(requestId: string, respondentId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "ConnectionRequest" SET "status" = 'ACCEPTED', "respondedAt" = NOW()
     WHERE "id" = $1 AND "toId" = $2 AND "status" = 'PENDING'`,
    requestId,
    respondentId
  );
}

export async function declineConnectionRequest(requestId: string, respondentId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "ConnectionRequest" SET "status" = 'DECLINED', "respondedAt" = NOW()
     WHERE "id" = $1 AND "toId" = $2 AND "status" = 'PENDING'`,
    requestId,
    respondentId
  );
}

export async function areConnected(userId1: string, userId2: string): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT 1 as n FROM "ConnectionRequest" c
     WHERE ((c."fromId" = $1 AND c."toId" = $2) OR (c."fromId" = $2 AND c."toId" = $1))
       AND c."status" = 'ACCEPTED' LIMIT 1`,
    userId1,
    userId2
  );
  return r.length > 0;
}

export async function createPost(
  authorId: string,
  body: string | null,
  imageUrls: string | null,
  contentId: string | null,
  projectId: string | null
): Promise<NetworkPostRow> {
  const postId = id();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "NetworkPost" ("id", "authorId", "body", "imageUrls", "contentId", "projectId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
    postId,
    authorId,
    body ?? null,
    imageUrls ?? null,
    contentId ?? null,
    projectId ?? null
  );
  const rows = await prisma.$queryRawUnsafe<NetworkPostRow[]>(
    `SELECT * FROM "NetworkPost" WHERE "id" = $1`,
    postId
  );
  if (!rows[0]) throw new Error("Failed to create post");
  return rows[0];
}

export async function getFeedPostIdsForUser(userId: string, limit: number): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT p."id" FROM "NetworkPost" p
     INNER JOIN "CreatorFollow" f ON f."followingId" = p."authorId" AND f."followerId" = $1
     ORDER BY p."createdAt" DESC LIMIT $2`,
    userId,
    limit
  );
  return rows.map((r) => r.id);
}

export async function getPublicFeedPostIds(limit: number): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT "id" FROM "NetworkPost" ORDER BY "createdAt" DESC LIMIT $1`,
    limit
  );
  return rows.map((r) => r.id);
}

export async function getPostsByIds(ids: string[]): Promise<NetworkPostRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await prisma.$queryRawUnsafe<NetworkPostRow[]>(
    `SELECT * FROM "NetworkPost" WHERE "id" IN (${placeholders}) ORDER BY "createdAt" DESC`,
    ...ids
  );
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getPostsByAuthorId(authorId: string, limit: number): Promise<NetworkPostRow[]> {
  const rows = await prisma.$queryRawUnsafe<NetworkPostRow[]>(
    `SELECT * FROM "NetworkPost" WHERE "authorId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
    authorId,
    limit
  );
  return rows;
}

export async function getConnectionRequestsReceived(userId: string): Promise<ConnectionRequestRow[]> {
  const rows = await prisma.$queryRawUnsafe<ConnectionRequestRow[]>(
    `SELECT * FROM "ConnectionRequest" WHERE "toId" = $1 AND "status" = 'PENDING' ORDER BY "createdAt" DESC`,
    userId
  );
  return rows;
}

export async function getConnectionRequestsSent(userId: string): Promise<ConnectionRequestRow[]> {
  const rows = await prisma.$queryRawUnsafe<ConnectionRequestRow[]>(
    `SELECT * FROM "ConnectionRequest" WHERE "fromId" = $1 ORDER BY "createdAt" DESC`,
    userId
  );
  return rows;
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ followingId: string }[]>(
    `SELECT "followingId" FROM "CreatorFollow" WHERE "followerId" = $1`,
    userId
  );
  return rows.map((r) => r.followingId);
}

export async function getFollowerCount(userId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) as n FROM "CreatorFollow" WHERE "followingId" = $1`,
    userId
  );
  return Number(rows[0]?.n ?? 0);
}

export async function getFollowingCount(userId: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) as n FROM "CreatorFollow" WHERE "followerId" = $1`,
    userId
  );
  return Number(rows[0]?.n ?? 0);
}
