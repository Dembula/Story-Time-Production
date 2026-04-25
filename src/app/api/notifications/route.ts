import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = clampInt(request.nextUrl.searchParams.get("limit"), 20, 1, 100);
  const offset = clampInt(request.nextUrl.searchParams.get("offset"), 0, 0, 100000);
  const onlyUnread = request.nextUrl.searchParams.get("onlyUnread") === "1";
  const where = { userId, ...(onlyUnread ? { read: false } : {}) };

  const [notifications, unreadCount, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.notification.count({ where }),
  ]);

  return NextResponse.json({
    notifications,
    unreadCount,
    total,
    limit,
    offset,
    hasMore: offset + notifications.length < total,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        ids?: string[];
        markAllRead?: boolean;
        read?: boolean;
      }
    | null;

  const read = body?.read !== false;
  const markAllRead = body?.markAllRead === true;
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((x) => typeof x === "string" && x.trim()) : [];

  if (!markAllRead && ids.length === 0) {
    return NextResponse.json({ error: "Provide ids[] or markAllRead=true" }, { status: 400 });
  }

  const where = markAllRead ? { userId } : { userId, id: { in: ids } };
  const result = await prisma.notification.updateMany({
    where,
    data: { read },
  });

  const unreadCount = await prisma.notification.count({ where: { userId, read: false } });
  return NextResponse.json({ ok: true, updated: result.count, unreadCount });
}

export async function POST(request: NextRequest) {
  // Reserved primarily for system/admin use to push Story Time notifications.
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    userId: string;
    type: string;
    title: string;
    body: string;
    metadata?: string;
  } | null;

  if (!body?.userId || !body.type || !body.title || !body.body) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const notification = await prisma.notification.create({
    data: {
      userId: body.userId,
      type: body.type,
      title: body.title,
      body: body.body,
      metadata: body.metadata,
    },
  });

  return NextResponse.json({ notification }, { status: 201 });
}

