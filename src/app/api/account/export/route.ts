import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    null
  );
}

/** GDPR / App Store: export the signed-in user's account data as JSON. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = await checkRateLimit({
    key: "account-export",
    ip: `${userId}:${clientIp(req)}`,
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many export requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phoneNumber: true,
      bio: true,
      location: true,
      website: true,
      professionalName: true,
      createdAt: true,
      updatedAt: true,
      accounts: { select: { provider: true, type: true, providerAccountId: true } },
      userRoles: { select: { role: true, createdAt: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [
    pitches,
    memberships,
    contents,
    musicTracks,
    subscriptions,
    contentAccess,
    castRoster,
    crewRoster,
    messagesSent,
    messagesReceived,
    watchlist,
    ratings,
    comments,
  ] = await Promise.all([
    prisma.originalPitch
      .findMany({
        where: { creatorId: userId },
        select: { id: true, title: true, status: true, projectId: true, createdAt: true },
      })
      .catch(() => []),
    prisma.originalMember
      .findMany({
        where: { userId },
        select: {
          projectId: true,
          role: true,
          status: true,
          createdAt: true,
          project: { select: { id: true, title: true, status: true, phase: true } },
        },
      })
      .catch(() => []),
    prisma.content
      .findMany({
        where: { creatorId: userId },
        select: { id: true, title: true, type: true, reviewStatus: true, createdAt: true },
      })
      .catch(() => []),
    prisma.musicTrack
      .findMany({
        where: { creatorId: userId },
        select: { id: true, title: true, published: true, createdAt: true },
      })
      .catch(() => []),
    prisma.viewerSubscription
      .findMany({
        where: { userId },
        select: { id: true, plan: true, status: true, createdAt: true },
      })
      .catch(() => []),
    prisma.viewerContentAccess
      .findMany({
        where: { userId },
        select: { contentId: true, createdAt: true },
      })
      .catch(() => []),
    prisma.creatorCastRoster
      .findMany({
        where: { creatorId: userId },
        select: { id: true, name: true, roleType: true, createdAt: true },
      })
      .catch(() => []),
    prisma.creatorCrewRoster
      .findMany({
        where: { creatorId: userId },
        select: { id: true, name: true, role: true, createdAt: true },
      })
      .catch(() => []),
    prisma.message
      .findMany({
        where: { senderId: userId },
        select: { id: true, receiverId: true, createdAt: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
    prisma.message
      .findMany({
        where: { receiverId: userId },
        select: { id: true, senderId: true, createdAt: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
    prisma.watchlistItem
      .findMany({
        where: { userId },
        select: { contentId: true, createdAt: true },
      })
      .catch(() => []),
    prisma.rating
      .findMany({
        where: { userId },
        select: { contentId: true, score: true, createdAt: true },
      })
      .catch(() => []),
    prisma.comment
      .findMany({
        where: { userId },
        select: { id: true, contentId: true, createdAt: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      })
      .catch(() => []),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user,
    pitches,
    projectMemberships: memberships,
    contents,
    musicTracks,
    subscriptions,
    contentAccess,
    castRoster,
    crewRoster,
    messageMetadata: {
      sent: messagesSent,
      received: messagesReceived,
      note: "Message bodies are omitted from export for privacy of other parties.",
    },
    watchlist,
    ratings,
    comments,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="storytime-account-export-${userId}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
